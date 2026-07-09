import { createFileRoute, redirect } from "@tanstack/react-router";

// Self-registration is disabled. Accounts are provisioned by admins.
export const Route = createFileRoute("/register")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
