import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy /auth route → land on the new role picker.
export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
