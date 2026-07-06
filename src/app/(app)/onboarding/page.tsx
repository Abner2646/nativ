import { requireUser, getUserTenants } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const { new: isNew } = await searchParams
  const user    = await requireUser()
  const tenants = await getUserTenants(user.id)

  // Only skip onboarding when the user has restaurants AND didn't explicitly
  // come here to create a new one (dashboard "Add restaurant" passes ?new=true).
  if (tenants.length > 0 && !isNew) {
    const first = (tenants[0] as any)?.tenants?.slug
    redirect(first ? `/restaurant/${first}` : '/dashboard')
  }

  return <OnboardingForm />
}
