import { createFileRoute } from "@tanstack/react-router";
import { AnuncioForm } from "@/components/AnuncioForm";

export const Route = createFileRoute("/_authenticated/vender/novo")({
  component: () => <AnuncioForm mode="create" />,
});
