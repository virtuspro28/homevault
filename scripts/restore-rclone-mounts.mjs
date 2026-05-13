import { RCloneService } from "../dist/services/rclone.service.js";

try {
  await RCloneService.restoreMountsOnBoot();
  process.exit(0);
} catch (error) {
  console.error("[restore-rclone-mounts] Error restaurando montajes:", error);
  process.exit(1);
}
