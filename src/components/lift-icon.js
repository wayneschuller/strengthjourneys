/**
 * The lucide icon a curated lift carries in navs and headers. The registry
 * stores only the icon's name (JSON cannot hold a component), and this is the
 * one place that name becomes a component. Today only the big four have one.
 */

import { createElement } from "react";
import { Crown, Luggage, Shield, Skull } from "lucide-react";

import { getCuratedLift } from "@/lib/lift-registry";

const ICONS = { Crown, Luggage, Shield, Skull };

/**
 * The icon component for a lift, or null when it has none.
 * @param {string} liftType
 */
export function getLiftIcon(liftType) {
  const name = getCuratedLift(liftType)?.icon;
  return (name && ICONS[name]) || null;
}

/**
 * Renders a lift's icon, or nothing. Extra props go to the lucide component.
 * @param {Object} props
 * @param {string} props.liftType
 */
export function LiftIcon({ liftType, ...props }) {
  const Icon = getLiftIcon(liftType);
  return Icon ? createElement(Icon, props) : null;
}
