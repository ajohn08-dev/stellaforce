/**
 * Maps a candidate's current_company (free text) to a logo asset in
 * public/logos/. Only the companies we have brand assets for resolve; every
 * other company falls back to a generic icon in the UI.
 */
const COMPANY_LOGOS: Record<string, string> = {
  apple: "/logos/apple.png",
  google: "/logos/google.png",
  alphabet: "/logos/google.png",
  meta: "/logos/meta.png",
  facebook: "/logos/meta.png",
  nvidia: "/logos/nvidia.png",
  tesla: "/logos/tesla.png",
  netflix: "/logos/netflix.png",
  intel: "/logos/intel.png",
  sap: "/logos/sap.png",
  broadcom: "/logos/broadcom.png",
  samsung: "/logos/samsung.png",
  cisco: "/logos/cisco.png",
  qualcomm: "/logos/qualcomm.png",
  spotify: "/logos/spotify.png",
  uber: "/logos/uber.png",
  github: "/logos/github.png",
}

export function companyLogoSrc(companyName: string | null | undefined): string | null {
  if (!companyName) return null
  return COMPANY_LOGOS[companyName.trim().toLowerCase()] ?? null
}
