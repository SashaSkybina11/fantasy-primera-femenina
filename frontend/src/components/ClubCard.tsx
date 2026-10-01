import { GoArrowRight } from "react-icons/go";
import { Link } from "react-router-dom";
import type { Club } from "../types";
import { ClubLogo } from "./ClubLogo";

export function ClubCard({ club }: { club: Club }) {
  return <Link to={`/teams/${club.id}`} className="club-card"><ClubLogo club={club} /><span>{club.name}</span><b><GoArrowRight className="ui-arrow" aria-hidden="true" /></b></Link>;
}
