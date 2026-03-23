import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App navigation", () => {
  it("renders all primary sections", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Чаты" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Чаты Telegram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Невыполненное" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Knowledge / Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Логи" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сервисы" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Настройки" })).toBeInTheDocument();
  });
});
