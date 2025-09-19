import { z } from "zod";

export interface User {
    id: string;
    username: string;
    expiresAt?: number;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export type SelectUser = User;

// zod schema for file validation
export const loginCredentialsSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required")
});
 