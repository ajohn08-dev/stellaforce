import { getCurrentProfile } from "@/lib/auth"
import { GenericHomeOverview } from "@/components/home/generic-home-overview"
import { RecruiterHome } from "@/components/home/recruiter-home"
import { ClientAdminHome } from "@/components/home/client-admin/client-admin-home"
import { InternalAdminHome } from "@/components/home/internal-admin/internal-admin-home"
import { ClientRecruiterHome } from "@/components/home/client-recruiter/client-recruiter-home"

export default async function HomePage() {
  const profile = await getCurrentProfile()

  if (profile?.side === "stellaforce" && profile.role === "recruiter") {
    return <RecruiterHome />
  }

  if (profile?.side === "stellaforce" && profile.role === "admin") {
    return <InternalAdminHome />
  }

  if (profile?.side === "client" && profile.client_role === "admin") {
    return <ClientAdminHome />
  }

  if (profile?.side === "client" && profile.client_role === "recruiter") {
    return <ClientRecruiterHome />
  }

  return <GenericHomeOverview />
}
