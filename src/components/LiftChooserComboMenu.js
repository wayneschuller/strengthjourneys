"use client";

import * as React from "react";

import FancyMultiSelect from "./ui/fancy-multi-select";

// We don't really need this component unless we make it a super card.

const LiftChooserComboMenu = ({
  placeholder,
  selected,
  setSelected,
  menuOptions,
}) => {
  return (
    <div>
      <FancyMultiSelect
        placeholder={placeholder}
        selected={selected}
        setSelected={setSelected}
        menuOptions={menuOptions}
      />
    </div>
  );
};

export default LiftChooserComboMenu;
