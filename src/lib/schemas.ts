import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email({ message: "validation.emailInvalid" }),
  password: z.string().min(6, { message: "validation.passwordMin" }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    tipo_perfil: z.enum(["comprador", "vendedor"]),
    nome_completo: z.string().min(2, { message: "validation.required" }),
    telefone: z.string().optional(),
    pais: z.string().min(2, { message: "validation.required" }),
    estado: z.string().optional(),
    cidade: z.string().optional(),
    email: z.string().email({ message: "validation.emailInvalid" }),
    password: z.string().min(6, { message: "validation.passwordMin" }),
    confirmPassword: z.string().min(6, { message: "validation.passwordMin" }),
    categorias_interesse: z
      .array(z.enum(["fruta", "grao", "legumes", "vegetal"]))
      .min(1, { message: "validation.minOneCategory" }),
    lgpd_aceito: z.literal(true, { message: "validation.lgpdRequired" } as never),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "validation.passwordsMatch",
    path: ["confirmPassword"],
  });
export type SignupInput = z.infer<typeof signupSchema>;
