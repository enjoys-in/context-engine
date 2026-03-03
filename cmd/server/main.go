package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/enjoys-in/context-engine/internal/db"
	"github.com/enjoys-in/context-engine/internal/handlers"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	port := flag.String("port", "3000", "Server port")
	dbPath := flag.String("db", "./context.db", "Path to Pebble database")
	dataDir := flag.String("data", "./data/commands", "Path to JSON command files to seed")
	seed := flag.Bool("seed", false, "Seed the database from JSON files on startup")
	flag.Parse()

	// Open Pebble store
	store, err := db.NewStore(*dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer store.Close()

	// Seed from JSON files if requested
	if *seed {
		seedFromFiles(store, *dataDir)
	}

	// Setup Fiber
	app := fiber.New(fiber.Config{
		AppName: "Context Engine API",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(recover.New())
	app.Use(cors.New())

	// Routes
	h := handlers.NewHandler(store)
	api := app.Group("/api")

	api.Get("/commands", h.ListCommands)             // List with pagination & search
	api.Get("/commands/search/:key", h.SearchByKey)   // Search by key prefix
	api.Get("/commands/:name", h.GetCommand)           // Get single command
	api.Post("/commands", h.AddCommand)                // Add command
	api.Delete("/commands/:name", h.DeleteCommand)     // Delete command

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	log.Printf("Context Engine API running on :%s", *port)
	log.Fatal(app.Listen(":" + *port))
}

func seedFromFiles(store *db.Store, dir string) {
	files, err := filepath.Glob(filepath.Join(dir, "*.json"))
	if err != nil {
		log.Printf("Warning: failed to glob seed files: %v", err)
		return
	}

	if len(files) == 0 {
		log.Printf("No JSON files found in %s", dir)
		return
	}

	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			log.Printf("Warning: failed to read %s: %v", f, err)
			continue
		}

		// Try single command
		if err := store.ImportCommand(data); err == nil {
			name := filepath.Base(f)
			log.Printf("Seeded: %s", name)
			continue
		}

		// Try array of commands
		var cmds []json.RawMessage
		if err := json.Unmarshal(data, &cmds); err == nil {
			for _, raw := range cmds {
				if err := store.ImportCommand(raw); err != nil {
					log.Printf("Warning: skipped entry in %s: %v", f, err)
				}
			}
			log.Printf("Seeded array: %s (%d entries)", filepath.Base(f), len(cmds))
		} else {
			log.Printf("Warning: failed to parse %s: %v", f, err)
		}
	}

	fmt.Println("Database seeding complete.")
}
