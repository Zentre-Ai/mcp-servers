import { describe, it, expect } from "vitest";

/**
 * Example test file for the calculator tool.
 *
 * These tests demonstrate how to test MCP tools.
 * In a real implementation, you would import and test the actual handler.
 */

// Mock calculator function for demonstration
function calculate(operation: string, a: number, b: number): number | Error {
  switch (operation) {
    case "add":
      return a + b;
    case "subtract":
      return a - b;
    case "multiply":
      return a * b;
    case "divide":
      if (b === 0) {
        return new Error("Division by zero");
      }
      return a / b;
    default:
      return new Error("Unknown operation");
  }
}

describe("Calculator Tool", () => {
  describe("addition", () => {
    it("should add two positive numbers", () => {
      const result = calculate("add", 2, 3);
      expect(result).toBe(5);
    });

    it("should add negative numbers", () => {
      const result = calculate("add", -2, -3);
      expect(result).toBe(-5);
    });

    it("should add with zero", () => {
      const result = calculate("add", 5, 0);
      expect(result).toBe(5);
    });
  });

  describe("subtraction", () => {
    it("should subtract two numbers", () => {
      const result = calculate("subtract", 5, 3);
      expect(result).toBe(2);
    });

    it("should handle negative results", () => {
      const result = calculate("subtract", 3, 5);
      expect(result).toBe(-2);
    });
  });

  describe("multiplication", () => {
    it("should multiply two numbers", () => {
      const result = calculate("multiply", 4, 3);
      expect(result).toBe(12);
    });

    it("should handle multiplication by zero", () => {
      const result = calculate("multiply", 5, 0);
      expect(result).toBe(0);
    });
  });

  describe("division", () => {
    it("should divide two numbers", () => {
      const result = calculate("divide", 10, 2);
      expect(result).toBe(5);
    });

    it("should handle decimal results", () => {
      const result = calculate("divide", 5, 2);
      expect(result).toBe(2.5);
    });

    it("should return error for division by zero", () => {
      const result = calculate("divide", 5, 0);
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe("Division by zero");
    });
  });

  describe("invalid operations", () => {
    it("should return error for unknown operation", () => {
      const result = calculate("modulo", 5, 2);
      expect(result).toBeInstanceOf(Error);
    });
  });
});
