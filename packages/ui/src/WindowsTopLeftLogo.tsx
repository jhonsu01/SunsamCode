import { cn } from "@/components/lib/utils.js";
<<<<<<< HEAD
import { sunsamAppLogoUrl as zaiLogoUrl } from "@/sunsam/logo.js";
import { SUNSAM_BRAND } from "@/sunsam/brand.js";
=======
import { ZCodeStartupLogoBadge } from "@/root/RootStartupLoading.js";
>>>>>>> 3c5b227649371507ddc4eb46ac5133afe6db1cab

export function WindowsTopLeftLogo({
  className,
  imageClassName,
}: {
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div
      className={cn(
        // Logo 底座和外部占位统一为 20px，保留原中心点（27px / 29px）。
        "absolute left-1 top-1 mt-px ml-px z-20 flex h-12 items-center px-3 [app-region:drag]",
        className,
      )}
    >
<<<<<<< HEAD
      <img
        src={zaiLogoUrl}
        alt={SUNSAM_BRAND.productName}
        className={cn("pointer-events-none size-5 select-none", imageClassName)}
        draggable={false}
      />
=======
      <span
        role="img"
        aria-label="ZCode"
        data-testid="settings-logo"
        className={cn(
          "pointer-events-none flex size-5 items-center justify-center select-none",
          imageClassName,
        )}
      >
        <ZCodeStartupLogoBadge size="titlebar" animated={false} />
      </span>
>>>>>>> 3c5b227649371507ddc4eb46ac5133afe6db1cab
    </div>
  );
}
