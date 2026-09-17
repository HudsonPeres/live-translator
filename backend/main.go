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
	"github.com/joho/godotenv" // ⬅️ NOVO
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type User struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Username string `gorm:"unique;not null" json:"username"`
	Email    string `gorm:"unique;not null" json:"email"`
	Password string `json:"-"`
	Role     string `gorm:"type:varchar(20);default:'TRANSLATOR'" json:"role"`
}

var db *gorm.DB
var jwtSecret []byte // ⬅️ Será preenchida a partir do .env

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

// ============================================
// SEED: cria o Super User usando variáveis do .env ⬅️
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
		log.Println("⚠️  Variáveis do Super User não definidas no .env — seed ignorado")
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
		log.Println("⚠️  Erro ao criar Super User:", err)
		return
	}

	// NUNCA logar a password, apenas o username
	fmt.Printf("👤 Super User criado: %s\n", username)
}

// ============================================
// MAIN
// ============================================

func main() {
	// 1. Carregar variáveis do .env
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  Arquivo .env não encontrado, usando variáveis do sistema")
	}

	// 2. Verificar segredos obrigatórios ⬅️
	jwtSecret = []byte(os.Getenv("JWT_SECRET"))
	if len(jwtSecret) < 32 {
		log.Fatal("❌ JWT_SECRET ausente ou muito curto no .env (mínimo 32 caracteres)")
	}

	// 3. Conectar ao PostgreSQL usando variáveis do .env ⬅️
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
	fmt.Println("✅ Conectado ao PostgreSQL")

	db.AutoMigrate(&User{})
	fmt.Println("✅ Migrations aplicadas")

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
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	fmt.Printf("🚀 Servidor em http://localhost:%s\n", port)
	r.Run(":" + port)
}