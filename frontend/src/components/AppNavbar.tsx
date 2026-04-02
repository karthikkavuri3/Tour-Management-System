"use client";

import React from "react";
import { Button } from "@/ui/components/Button";
import { LinkButton } from "@/ui/components/LinkButton";
import { FeatherCompass, FeatherLogOut } from "@subframe/core";
import type { Session } from "@/lib/models";

export interface NavLink {
  label: string;
  active: boolean;
  onClick: () => void;
}

interface Props {
  session: Session;
  onLogout: () => void;
  links: NavLink[];
  /** Shown next to the compass icon. Defaults to "Wanderlust". */
  brandName?: string;
}

export default function AppNavbar({
  session,
  onLogout,
  links,
  brandName = "Wanderlust",
}: Props) {
  return (
    <div className="flex w-full flex-none items-center gap-8 border-b border-solid border-neutral-border bg-neutral-50 px-10 py-5 mobile:px-4 mobile:py-4">

      {/* Brand */}
      <div className="flex items-center gap-3">
        <FeatherCompass className="text-heading-1 font-heading-1 text-brand-600" />
        <span className="text-heading-2 font-heading-2 text-default-font">{brandName}</span>
      </div>

      {/* Nav links */}
      <div className="flex grow shrink-0 basis-0 items-center justify-center gap-8 mobile:hidden">
        {links.map((link) => (
          <LinkButton
            key={link.label}
            variant={link.active ? "brand" : "neutral"}
            onClick={link.onClick}
          >
            <span className="text-heading-3 font-heading-3">{link.label}</span>
          </LinkButton>
        ))}
      </div>

      {/* User name + logout */}
      <div className="flex items-center gap-4 flex-none">
        <span className="text-heading-3 font-heading-3 text-default-font mobile:hidden">
          {session.fullName}
        </span>
        <Button
          variant="neutral-secondary"
          icon={<FeatherLogOut />}
          onClick={onLogout}
        >
          Logout
        </Button>
      </div>
    </div>
  );
}
