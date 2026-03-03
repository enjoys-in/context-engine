package handlers

import (
	"math"
	"strconv"

	"github.com/enjoys-in/context-engine/internal/db"
	"github.com/enjoys-in/context-engine/internal/models"
	"github.com/gofiber/fiber/v2"
)

// Handler holds the database store
type Handler struct {
	store *db.Store
}

// NewHandler creates a new Handler
func NewHandler(store *db.Store) *Handler {
	return &Handler{store: store}
}

// AddCommand handles POST /api/commands
func (h *Handler) AddCommand(c *fiber.Ctx) error {
	var cmd models.Command
	if err := c.BodyParser(&cmd); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:   "bad_request",
			Message: "Invalid JSON body: " + err.Error(),
		})
	}

	if cmd.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:   "validation_error",
			Message: "Command name is required",
		})
	}

	if err := h.store.AddCommand(cmd); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
			Error:   "internal_error",
			Message: err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Command added successfully",
		"command": cmd.Name,
	})
}

// DeleteCommand handles DELETE /api/commands/:name
func (h *Handler) DeleteCommand(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:   "bad_request",
			Message: "Command name is required",
		})
	}

	// Check if it exists
	existing, err := h.store.GetCommand(name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
			Error:   "internal_error",
			Message: err.Error(),
		})
	}
	if existing == nil {
		return c.Status(fiber.StatusNotFound).JSON(models.ErrorResponse{
			Error:   "not_found",
			Message: "Command '" + name + "' not found",
		})
	}

	if err := h.store.DeleteCommand(name); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
			Error:   "internal_error",
			Message: err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Command deleted successfully",
		"command": name,
	})
}

// GetCommand handles GET /api/commands/:name
func (h *Handler) GetCommand(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:   "bad_request",
			Message: "Command name is required",
		})
	}

	cmd, err := h.store.GetCommand(name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
			Error:   "internal_error",
			Message: err.Error(),
		})
	}
	if cmd == nil {
		return c.Status(fiber.StatusNotFound).JSON(models.ErrorResponse{
			Error:   "not_found",
			Message: "Command '" + name + "' not found",
		})
	}

	return c.JSON(cmd)
}

// ListCommands handles GET /api/commands?page=1&per_page=20&search=keyword
func (h *Handler) ListCommands(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	search := c.Query("search", "")

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	commands, total, err := h.store.ListCommands(page, perPage, search)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
			Error:   "internal_error",
			Message: err.Error(),
		})
	}

	totalPages := int(math.Ceil(float64(total) / float64(perPage)))

	return c.JSON(models.PaginatedResponse{
		Data:       commands,
		Total:      total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: totalPages,
	})
}

// SearchByKey handles GET /api/commands/search/:key
func (h *Handler) SearchByKey(c *fiber.Ctx) error {
	key := c.Params("key")
	if key == "" {
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:   "bad_request",
			Message: "Search key is required",
		})
	}

	results, err := h.store.SearchByKey(key)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
			Error:   "internal_error",
			Message: err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data":  results,
		"total": len(results),
	})
}
