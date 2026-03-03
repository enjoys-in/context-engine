package db

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/cockroachdb/pebble"
	"github.com/enjoys-in/context-engine/internal/models"
)

// Store wraps Pebble DB operations
type Store struct {
	db *pebble.DB
	mu sync.RWMutex
}

// NewStore opens a Pebble database at the given path
func NewStore(path string) (*Store, error) {
	db, err := pebble.Open(path, &pebble.Options{})
	if err != nil {
		return nil, fmt.Errorf("failed to open pebble db: %w", err)
	}
	return &Store{db: db}, nil
}

// Close closes the database
func (s *Store) Close() error {
	return s.db.Close()
}

// keyFor builds the db key: "cmd:<name>"
func keyFor(name string) []byte {
	return []byte("cmd:" + strings.ToLower(name))
}

// AddCommand stores a command in the database
func (s *Store) AddCommand(cmd models.Command) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.Marshal(cmd)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	key := keyFor(cmd.Name)
	if err := s.db.Set(key, data, pebble.Sync); err != nil {
		return fmt.Errorf("pebble set error: %w", err)
	}
	return nil
}

// GetCommand retrieves a single command by name
func (s *Store) GetCommand(name string) (*models.Command, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key := keyFor(name)
	val, closer, err := s.db.Get(key)
	if err != nil {
		if err == pebble.ErrNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("pebble get error: %w", err)
	}
	defer closer.Close()

	var cmd models.Command
	if err := json.Unmarshal(val, &cmd); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}
	return &cmd, nil
}

// DeleteCommand removes a command by name
func (s *Store) DeleteCommand(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := keyFor(name)
	if err := s.db.Delete(key, pebble.Sync); err != nil {
		return fmt.Errorf("pebble delete error: %w", err)
	}
	return nil
}

// ListCommands returns all commands with pagination and optional search
func (s *Store) ListCommands(page, perPage int, search string) ([]models.Command, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var allCommands []models.Command
	prefix := []byte("cmd:")

	iter, err := s.db.NewIter(&pebble.IterOptions{
		LowerBound: prefix,
		UpperBound: []byte("cmd;"), // ';' is next char after ':'
	})
	if err != nil {
		return nil, 0, fmt.Errorf("pebble iter error: %w", err)
	}
	defer iter.Close()

	search = strings.ToLower(search)

	for iter.First(); iter.Valid(); iter.Next() {
		var cmd models.Command
		if err := json.Unmarshal(iter.Value(), &cmd); err != nil {
			continue
		}

		// Filter by search query (match against key/name/description/category)
		if search != "" {
			nameLower := strings.ToLower(cmd.Name)
			descLower := strings.ToLower(cmd.Description)
			catLower := strings.ToLower(cmd.Category)
			if !strings.Contains(nameLower, search) &&
				!strings.Contains(descLower, search) &&
				!strings.Contains(catLower, search) {
				continue
			}
		}

		allCommands = append(allCommands, cmd)
	}

	total := len(allCommands)

	// Pagination
	start := (page - 1) * perPage
	if start > total {
		start = total
	}
	end := start + perPage
	if end > total {
		end = total
	}

	return allCommands[start:end], total, nil
}

// SearchByKey returns a command matching exact key prefix
func (s *Store) SearchByKey(keyPrefix string) ([]models.Command, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []models.Command
	prefix := []byte("cmd:" + strings.ToLower(keyPrefix))

	iter, err := s.db.NewIter(&pebble.IterOptions{
		LowerBound: prefix,
		UpperBound: append(prefix, 0xFF),
	})
	if err != nil {
		return nil, fmt.Errorf("pebble iter error: %w", err)
	}
	defer iter.Close()

	for iter.First(); iter.Valid(); iter.Next() {
		var cmd models.Command
		if err := json.Unmarshal(iter.Value(), &cmd); err != nil {
			continue
		}
		results = append(results, cmd)
	}
	return results, nil
}

// ImportCommand loads a command from JSON bytes
func (s *Store) ImportCommand(data []byte) error {
	var cmd models.Command
	if err := json.Unmarshal(data, &cmd); err != nil {
		return fmt.Errorf("invalid command JSON: %w", err)
	}
	if cmd.Name == "" {
		return fmt.Errorf("command name is required")
	}
	return s.AddCommand(cmd)
}
