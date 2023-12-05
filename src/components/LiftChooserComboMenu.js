"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import FancyMultiSelect from "./ui/fancy-multi-select";

const LiftChooserComboMenu = () => {
  return (
    <div>
      <FancyMultiSelect placeholder={"Choose lift types"} />
    </div>
  );
};

export default LiftChooserComboMenu;
