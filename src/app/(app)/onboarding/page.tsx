import { requireUser, getUserTenants } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage() {
  const user    = await requireUser()
  const tenants = await getUserTenants(user.id)

  // If the user already has at least one restaurant, skip onboarding.
  // This prevents the OAuth ?next=/onboarding flow from forcing a second restaurant.
  if (tenants.length > 0) {
    const first = (tenants[0] as any)?.tenants?.slug
    redirect(first ? `/restaurant/${first}` : '/dashboard')
  }

  return <OnboardingForm />
}
