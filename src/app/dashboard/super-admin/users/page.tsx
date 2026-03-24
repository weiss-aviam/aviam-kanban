import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { SuperAdminUserManagement } from "@/components/admin/SuperAdminUserManagement";
import { AppHeader } from "@/components/layout/AppHeader";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default async function SuperAdminUsersPage() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      redirect("/auth/login");
    }

    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title={t("superAdmin.title")}
        subtitle={t("superAdmin.subtitle")}
        navActions={<HeaderActions />}
        actionsStart={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard" title={t("superAdmin.backToDashboard")}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("superAdmin.backToDashboard")}
              </span>
            </Link>
          </Button>
        }
        actions={
          <Badge>
            <Shield className="h-3 w-3" />
            {t("superAdmin.superAdminBadge")}
          </Badge>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <SuperAdminUserManagement />
      </main>
    </div>
  );
}
