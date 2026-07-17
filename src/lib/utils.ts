import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isGithubUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes("github.com")
  } catch {
    return false
  }
}
