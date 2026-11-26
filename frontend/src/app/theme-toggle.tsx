import { Button } from "../components/ui/button";
import { useTheme } from "./use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      onClick={toggleTheme}
      aria-label={
        "Switch to " + (theme === "light" ? "dark" : "light") + " theme"
      }
    >
      {theme === "light" ? "Dark theme" : "Light theme"}
    </Button>
  );
}
