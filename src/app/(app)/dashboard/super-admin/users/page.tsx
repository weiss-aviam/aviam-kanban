import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Shield } from "lucide-react";
import { SuperAdminUserManagement } from "@/components/admin/SuperAdminUserManagement";
import { ContentTopBar } from "@/components/layout/ContentTopBar";
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
    <div className="flex min-h-screen flex-col">
      <ContentTopBar
        title={t("superAdmin.title")}
        subtitle={t("superAdmin.subtitle")}
        actionsStart={
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 gap-0.5 px-1.5 text-primary hover:bg-primary/5 hover:text-primary"
          >
            <Link href="/dashboard" title={t("superAdmin.backToDashboard")}>
              <ChevronLeft className="size-4" strokeWidth={2.25} />
              <span className="hidden sm:inline text-[13px] font-medium">
                {t("sidebar.dashboard")}
              </span>
            </Link>
          </Button>
        }
        actions={
          <Badge>
            <Shield className="h-3 w-3" />
            <span className="hidden sm:inline">
              {t("superAdmin.superAdminBadge")}
            </span>
          </Badge>
        }
      />

      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <SuperAdminUserManagement />
      </main>
    </div>
  );
}
