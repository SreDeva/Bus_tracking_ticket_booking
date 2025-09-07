package main

import (
	"github.com/abhinav/gofr"
	"net/http"
)

func main() {
	app := gofr.New()

	app.GET("/", func(ctx *gofr.Context) (interface{}, error) {
		return "Welcome to Gofr backend!", nil
	})

	app.GET("/health", func(ctx *gofr.Context) (interface{}, error) {
		return map[string]string{"status": "ok"}, nil
	})

	// Demo: List users
	app.GET("/users", func(ctx *gofr.Context) (interface{}, error) {
		users := []map[string]interface{}{
			{"id": 1, "name": "Alice"},
			{"id": 2, "name": "Bob"},
		}
		return users, nil
	})

	// Demo: Get user by ID
	app.GET("/users/{id}", func(ctx *gofr.Context) (interface{}, error) {
		id := ctx.PathParam("id")
		user := map[string]interface{}{"id": id, "name": "Demo User"}
		return user, nil
	})

	// Demo: List buses
	app.GET("/buses", func(ctx *gofr.Context) (interface{}, error) {
		buses := []map[string]interface{}{
			{"id": 101, "route": "A-B"},
			{"id": 102, "route": "B-C"},
		}
		return buses, nil
	})

	// Demo: Get bus by ID
	app.GET("/buses/{id}", func(ctx *gofr.Context) (interface{}, error) {
		id := ctx.PathParam("id")
		bus := map[string]interface{}{"id": id, "route": "Demo Route"}
		return bus, nil
	})

	// Demo: Book ticket
	app.POST("/tickets/book", func(ctx *gofr.Context) (interface{}, error) {
		// In real app, parse request body
		return map[string]interface{}{"ticket_id": 555, "status": "booked"}, nil
	})

	// Demo: Validate ticket
	app.POST("/tickets/validate", func(ctx *gofr.Context) (interface{}, error) {
		// In real app, parse request body
		return map[string]interface{}{"ticket_id": 555, "valid": true}, nil
	})

	// Demo: Live bus location
	app.GET("/bus/location/{id}", func(ctx *gofr.Context) (interface{}, error) {
		id := ctx.PathParam("id")
		location := map[string]interface{}{"bus_id": id, "lat": 12.9716, "lng": 77.5946}
		return location, nil
	})

	app.Start()
}
