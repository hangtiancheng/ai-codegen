import type { ReactNode } from "react";
import type { UserVo } from "@/shared/schemas";
import { Avatar } from "./avatar";

type UserInfoSize = "sm" | "md" | "lg";

export type UserInfoProps = {
  readonly user?: UserVo | undefined;
  readonly size?: UserInfoSize;
  readonly showName?: boolean;
};

const avatarSize: Record<UserInfoSize, "sm" | "md" | "lg"> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

export function UserInfo({ user, size = "md", showName = true }: UserInfoProps): ReactNode {
  const name = user?.username ?? user?.userAccount ?? "Unknown User";

  return (
    <div className="inline-flex min-w-0 items-center gap-2">
      <Avatar src={user?.userAvatar} name={name} size={avatarSize[size]} />
      {showName ? (
        <span className="text-foreground truncate text-sm font-medium">{name}</span>
      ) : null}
    </div>
  );
}
