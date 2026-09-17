package main

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"github.com/livekit/protocol/auth"
	livekit "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
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
var jwtSecret []byte

// Salas permitidas (whitelist para evitar criacao de salas arbitrarias)
var allowedRooms = map[string]bool{
	"english":  true,
	"espanhol": true,
}

// ============================================
// UTILITARIOS: JWT
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
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token nao fornecido"})
			c.Abort()
			return
		}

		tokenString := ""
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			tokenString = authHeader[7:]
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Formato do token invalido"})
			c.Abort()
			return
		}

		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token invalido ou expirado"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Claims invalidas"})
			c.Abort()
			return
		}

		c.Set("user_id", uint(claims["user_id"].(float64)))
		c.Set("username", claims["username"].(string))
		c.Set("role", claims["role"].(string))
		c.Next()
	}
}

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
// HANDLERS: AUTH
// ============================================

func loginHandler(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username e password sao obrigatorios"})
		return
	}

	var user User
	if err := db.Where("username = ?", input.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciais invalidas"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciais invalidas"})
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilizador nao encontrado"})
		return
	}
	c.JSON(http.StatusOK, user)
}

// ============================================
// HANDLERS: PERFIL
// ============================================

func updateOwnProfileHandler(c *gin.Context) {
	userID := c.GetUint("user_id")

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilizador nao encontrado"})
		return
	}

	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Email != "" && input.Email != user.Email {
		var existing User
		if err := db.Where("email = ? AND id != ?", input.Email, user.ID).
			First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email ja esta em uso"})
			return
		}
		user.Email = input.Email
	}

	if input.Password != "" {
		if len(input.Password) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password deve ter pelo menos 6 caracteres"})
			return
		}
		hashed, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		user.Password = string(hashed)
	}

	if err := db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar perfil"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
		"role":     user.Role,
	})
}

// ============================================
// HANDLERS: USERS (SUPER_USER)
// ============================================

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

	var existing User
	if err := db.Where("username = ? OR email = ?", input.Username, input.Email).
		First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username ou email ja existe"})
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

func listUsersHandler(c *gin.Context) {
	var users []User
	if err := db.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao listar utilizadores"})
		return
	}
	c.JSON(http.StatusOK, users)
}

func updateUserHandler(c *gin.Context) {
	id := c.Param("id")

	var user User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilizador nao encontrado"})
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

	if input.Username != "" && input.Username != user.Username {
		var existing User
		if err := db.Where("username = ? AND id != ?", input.Username, user.ID).
			First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Username ja existe"})
			return
		}
		user.Username = input.Username
	}

	if input.Email != "" && input.Email != user.Email {
		var existing User
		if err := db.Where("email = ? AND id != ?", input.Email, user.ID).
			First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email ja existe"})
			return
		}
		user.Email = input.Email
	}

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

func deleteUserHandler(c *gin.Context) {
	id := c.Param("id")

	currentUserID := c.GetUint("user_id")
	if id == fmt.Sprint(currentUserID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nao pode apagar o proprio utilizador"})
		return
	}

	var user User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilizador nao encontrado"})
		return
	}

	if err := db.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao apagar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Utilizador apagado"})
}

func resetPasswordHandler(c *gin.Context) {
	id := c.Param("id")

	var user User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Utilizador nao encontrado"})
		return
	}

	newPassword := generateRandomPassword(10)
	hashed, _ := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)

	user.Password = string(hashed)
	if err := db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao atualizar password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Password resetada com sucesso",
		"new_password": newPassword,
		"email":        user.Email,
	})
}

// ============================================
// HANDLERS: LIVEKIT
// ============================================

// POST /api/token
// Gera um token de acesso ao LiveKit.
// Subscriber (ouvinte): acesso publico, sem autenticacao.
// Publisher (tradutor): exige JWT valido no header Authorization.
func generateLiveKitTokenHandler(c *gin.Context) {
	var input struct {
		Room     string `json:"room" binding:"required"`
		Identity string `json:"identity" binding:"required"`
		Role     string `json:"role" binding:"required,oneof=publisher subscriber"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Whitelist de salas
	if !allowedRooms[input.Room] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sala invalida"})
		return
	}

	// Publisher exige JWT valido
	if input.Role == "publisher" {
		authHeader := c.GetHeader("Authorization")
		if len(authHeader) <= 7 || authHeader[:7] != "Bearer " {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Autenticacao requerida para publicar"})
			return
		}
		tokenStr := authHeader[7:]
		tok, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if err != nil || !tok.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token invalido para publicar"})
			return
		}
	}

	// Gerar token LiveKit
	at := auth.NewAccessToken(
		os.Getenv("LIVEKIT_API_KEY"),
		os.Getenv("LIVEKIT_API_SECRET"),
	)

	grant := &auth.VideoGrant{
		RoomJoin: true,
		Room:     input.Room,
	}

	if input.Role == "publisher" {
		grant.SetCanPublish(true)
		grant.SetCanSubscribe(true)
	} else {
		grant.SetCanPublish(false)
		grant.SetCanSubscribe(true)
	}

	at.SetVideoGrant(grant).
		SetIdentity(input.Identity).
		SetValidFor(time.Hour)

	token, err := at.ToJWT()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao gerar token LiveKit"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"url":   os.Getenv("LIVEKIT_URL"),
	})
}

// GET /api/rooms/:room/status
// Verifica se existe algum publisher ativo na sala.
func roomStatusHandler(c *gin.Context) {
	roomName := c.Param("room")

	if !allowedRooms[roomName] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sala invalida"})
		return
	}

	// RoomServiceClient precisa de http(s), nao ws(s)
	host := os.Getenv("LIVEKIT_URL")
	host = strings.Replace(host, "wss://", "https://", 1)
	host = strings.Replace(host, "ws://", "http://", 1)

	roomClient := lksdk.NewRoomServiceClient(
		host,
		os.Getenv("LIVEKIT_API_KEY"),
		os.Getenv("LIVEKIT_API_SECRET"),
	)

	res, err := roomClient.ListParticipants(
		context.Background(),
		&livekit.ListParticipantsRequest{Room: roomName},
	)

	if err != nil {
		// Sala nao existe ou erro de conexao -> offline
		c.JSON(http.StatusOK, gin.H{"online": false})
		return
	}

	// Considera online se algum participante tiver uma track de audio publicada
	online := false
	for _, p := range res.Participants {
		for _, t := range p.Tracks {
			if t.Type == livekit.TrackType_AUDIO {
				online = true
				break
			}
		}
		if online {
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{"online": online})
}

// ============================================
// SEED
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

	if username == "" || email == "" || password == "" {
		log.Println("Variaveis do Super User nao definidas no .env - seed ignorado")
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
		log.Println("Erro ao criar Super User:", err)
		return
	}

	fmt.Printf("Super User criado: %s\n", username)
}

// ============================================
// MAIN
// ============================================

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Arquivo .env nao encontrado, usando variaveis do sistema")
	}

	jwtSecret = []byte(os.Getenv("JWT_SECRET"))
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET ausente ou muito curto no .env (minimo 32 caracteres)")
	}

	// Validar variaveis do LiveKit
	if os.Getenv("LIVEKIT_API_KEY") == "" || os.Getenv("LIVEKIT_API_SECRET") == "" || os.Getenv("LIVEKIT_URL") == "" {
		log.Fatal("Variaveis LIVEKIT_API_KEY, LIVEKIT_API_SECRET e LIVEKIT_URL sao obrigatorias")
	}

		sslmode := os.Getenv("DB_SSLMODE")
	if sslmode == "" {
		sslmode = "disable"
	}

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
		sslmode,
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

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "https://ltc-vert.vercel.app/"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// Rotas publicas
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})
	r.POST("/api/login", loginHandler)
	r.POST("/api/token", generateLiveKitTokenHandler)          // publico (subscriber); exige JWT para publisher
	r.GET("/api/rooms/:room/status", roomStatusHandler)         // publico

	// Rotas protegidas
	api := r.Group("/api")
	api.Use(authMiddleware())
	{
		api.GET("/me", meHandler)
		api.PUT("/profile", updateOwnProfileHandler)

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