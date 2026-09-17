package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"crypto/rand"
"math/big"
)

type User struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Username string `gorm:"unique;not null" json:"username"`
	Email    string `gorm:"unique;not null" json:"email"`
	Password string `json:"-"`
	Role     string `gorm:"type:varchar(20);default:'TRANSLATOR'" json:"role"`
}

var db *gorm.DB
var jwtSecret []byte // Será preenchida a partir do .env

// ============================================
// UTILITÁRIOS: JWT
// ============================================

func generateToken(user User) (string, error) {
	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"role":     user.Role,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
		"iat":      time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// Gera uma password aleatória para reset
func generateRandomPassword(length int) string {
	const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, length)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		b[i] = chars[n.Int64()]
	}
	return string(b)
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token não fornecido"})
			c.Abort()
			return
		}

		tokenString := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tokenString = authHeader[7:]
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Formato do token inválido"})
			c.Abort()
			return
		}

		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido ou expirado"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Claims inválidas"})
			c.Abort()
			return
		}

		c.Set("user_id", uint(claims["user_id"].(float64)))
		c.Set("username", claims["username"].(string))
		c.Set("role", claims["role"].(string))
		c.Next()
	}
}

// Middleware que exige role SUPER_USER
func superUserMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists || role != "SUPER_USER" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Acesso restrito ao Super User"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// ============================================
// HANDLERS
// ============================================

func loginHandler(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username e password são obrigatórios"})
		return
	}

	var user User
	if err := db.Where("username = ?", input.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciais inválidas"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciais inválidas"})
		return
	}

	token, err := generateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao gerar token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"role":     user.Role,
		},
	})
}

func meHandler(c *gin.Context) {
	userID := c.GetUint("user_id")
	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilizador não encontrado"})
		return
	}
	c.JSON(http.StatusOK, user)
}

// POST /api/users  (apenas SUPER_USER)
func createUserHandler(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required,min=3"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		Role     string `json:"role" binding:"required,oneof=TRANSLATOR SUPER_USER"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verificar duplicados (username ou email)
	var existing User
	if err := db.Where("username = ? OR email = ?", input.Username, input.Email).
		First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username ou email já existe"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao processar password"})
		return
	}

	newUser := User{
		Username: input.Username,
		Email:    input.Email,
		Password: string(hashed),
		Role:     input.Role,
	}

	if err := db.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao criar utilizador"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":       newUser.ID,
		"username": newUser.Username,
		"email":    newUser.Email,
		"role":     newUser.Role,
	})
}

// GET /api/users  (apenas SUPER_USER)
func listUsersHandler(c *gin.Context) {
	var users []User
	if err := db.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao listar utilizadores"})
		return
	}
	c.JSON(http.StatusOK, users)
}

// PUT /api/users/:id  (apenas SUPER_USER)
func updateUserHandler(c *gin.Context) {
	id := c.Param("id")

	var user User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilizador não encontrado"})
		return
	}

	var input struct {
		Username string `json:"username"`
		Email    string `json:"email"`   
		Password string `json:"password"` 
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Atualizar username (verificar duplicado)
	if input.Username != "" && input.Username != user.Username {
		var existing User
		if err := db.Where("username = ? AND id != ?", input.Username, user.ID).
			First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Username já existe"})
			return
		}
		user.Username = input.Username
	}

	// Atualizar email (verificar duplicado)
	if input.Email != "" && input.Email != user.Email {
		var existing User
		if err := db.Where("email = ? AND id != ?", input.Email, user.ID).
			First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email já existe"})
			return
		}
		user.Email = input.Email
	}

	// Atualizar password
	if input.Password != "" {
		if len(input.Password) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password deve ter pelo menos 6 caracteres"})
			return
		}
		hashed, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		user.Password = string(hashed)
	}

	if err := db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
		"role":     user.Role,
	})
}

// DELETE /api/users/:id  (apenas SUPER_USER)
func deleteUserHandler(c *gin.Context) {
	id := c.Param("id")

	// Impedir que o próprio Super User se apague a si mesmo
	currentUserID := c.GetUint("user_id")
	if id == fmt.Sprint(currentUserID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Não pode apagar o próprio utilizador"})
		return
	}

	var user User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilizador não encontrado"})
		return
	}

	if err := db.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao apagar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Utilizador apagado"})
}

// POST /api/users/:id/reset-password  (apenas SUPER_USER)
func resetPasswordHandler(c *gin.Context) {
	id := c.Param("id")

	var user User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilizador não encontrado"})
		return
	}

	// Gerar nova password temporária
	newPassword := generateRandomPassword(10)
	hashed, _ := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)

	user.Password = string(hashed)
	if err := db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar password"})
		return
	}

	// MVP: retorna a password na resposta para o Super User copiar.
	// TODO (produção): enviar por email e NUNCA retornar na resposta.
	c.JSON(http.StatusOK, gin.H{
		"message":      "Password resetada com sucesso",
		"new_password": newPassword,
		"email":        user.Email,
	})
}

// ============================================
// SEED: cria o Super User usando variáveis do .env
// ============================================

func seedSuperUser() {
	var count int64
	db.Model(&User{}).Where("role = ?", "SUPER_USER").Count(&count)
	if count > 0 {
		return
	}

	username := os.Getenv("SUPER_USER_USERNAME")
	email := os.Getenv("SUPER_USER_EMAIL")
	password := os.Getenv("SUPER_USER_PASSWORD")

	// Segurança: se alguma variável estiver vazia, não cria nada
	if username == "" || email == "" || password == "" {
		log.Println(" Variáveis do Super User não definidas no .env — seed ignorado")
		return
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	superUser := User{
		Username: username,
		Email:    email,
		Password: string(hashedPassword),
		Role:     "SUPER_USER",
	}

	if err := db.Create(&superUser).Error; err != nil {
		log.Println(" Erro ao criar Super User:", err)
		return
	}

	// NUNCA logar a password, apenas o username
	fmt.Printf(" Super User criado: %s\n", username)
}

// ============================================
// MAIN
// ============================================

func main() {
	// 1. Carregar variáveis do .env
	if err := godotenv.Load(); err != nil {
		log.Println("Arquivo .env não encontrado, usando variáveis do sistema")
	}

	// 2. Verificar segredos obrigatórios 
	jwtSecret = []byte(os.Getenv("JWT_SECRET"))
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET ausente ou muito curto no .env (mínimo 32 caracteres)")
	}

	// 3. Conectar ao PostgreSQL usando variáveis do .env 
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)
	var err error
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Falha ao conectar no banco de dados:", err)
	}
	fmt.Println("Conectado ao PostgreSQL")

	db.AutoMigrate(&User{})
	fmt.Println("Migrations aplicadas")

	seedSuperUser()

	// 4. Servidor
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})
	r.POST("/api/login", loginHandler)

		api := r.Group("/api")
	api.Use(authMiddleware())
	{
		api.GET("/me", meHandler)

		// Rotas exclusivas do Super User
				admin := api.Group("")
		admin.Use(superUserMiddleware())
		{
			admin.POST("/users", createUserHandler)
			admin.GET("/users", listUsersHandler)
			admin.PUT("/users/:id", updateUserHandler)              
			admin.DELETE("/users/:id", deleteUserHandler)           
			admin.POST("/users/:id/reset-password", resetPasswordHandler) 
		}
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	fmt.Printf("Servidor em http://localhost:%s\n", port)
	r.Run(":" + port)
}