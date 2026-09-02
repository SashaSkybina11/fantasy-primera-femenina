import { PlayerPosition } from "@prisma/client";

export type SeedPlayer = {
  club: "Futsi Atlético Navalcarnero" | "STV Roldán";
  number: number;
  name: string;
  position: PlayerPosition;
  price: number;
};

const goalkeeper = PlayerPosition.GOALKEEPER;
const fieldPlayer = PlayerPosition.FIELD_PLAYER;

export const players: SeedPlayer[] = [
  { club: "Futsi Atlético Navalcarnero", number: 18, name: "Bea Parrón", position: goalkeeper, price: 5200 },
  { club: "Futsi Atlético Navalcarnero", number: 15, name: "Etayo", position: goalkeeper, price: 3200 },
  { club: "Futsi Atlético Navalcarnero", number: 25, name: "Mavi", position: fieldPlayer, price: 3800 },
  { club: "Futsi Atlético Navalcarnero", number: 7, name: "Laura Cordoba", position: fieldPlayer, price: 5900 },
  { club: "Futsi Atlético Navalcarnero", number: 5, name: "Ariane (Ari)", position: fieldPlayer, price: 6800 },
  { club: "Futsi Atlético Navalcarnero", number: 9, name: "Luchi", position: fieldPlayer, price: 7200 },
  { club: "Futsi Atlético Navalcarnero", number: 12, name: "Eli", position: fieldPlayer, price: 4600 },
  { club: "Futsi Atlético Navalcarnero", number: 6, name: "Albita", position: fieldPlayer, price: 4100 },
  { club: "Futsi Atlético Navalcarnero", number: 19, name: "Marian", position: fieldPlayer, price: 5600 },
  { club: "Futsi Atlético Navalcarnero", number: 11, name: "Maria Sans", position: fieldPlayer, price: 5000 },
  { club: "Futsi Atlético Navalcarnero", number: 14, name: "Anita Lujan", position: fieldPlayer, price: 6400 },
  { club: "Futsi Atlético Navalcarnero", number: 13, name: "Rocio", position: fieldPlayer, price: 3600 },
  { club: "Futsi Atlético Navalcarnero", number: 10, name: "Riscos", position: fieldPlayer, price: 4400 },
  { club: "Futsi Atlético Navalcarnero", number: 8, name: "Irene Cordoba", position: fieldPlayer, price: 4700 },
  { club: "Futsi Atlético Navalcarnero", number: 2, name: "Ju Delgado", position: fieldPlayer, price: 3000 },
  { club: "STV Roldán", number: 13, name: "Cristina", position: goalkeeper, price: 4300 },
  { club: "STV Roldán", number: 34, name: "Daniela", position: goalkeeper, price: 3000 },
  { club: "STV Roldán", number: 1, name: "Almudena", position: goalkeeper, price: 3500 },
  { club: "STV Roldán", number: 23, name: "Carmen", position: fieldPlayer, price: 4000 },
  { club: "STV Roldán", number: 10, name: "Andrea", position: fieldPlayer, price: 5600 },
  { club: "STV Roldán", number: 24, name: "Cecilia (Ceci)", position: fieldPlayer, price: 6500 },
  { club: "STV Roldán", number: 9, name: "Eva González", position: fieldPlayer, price: 7800 },
  { club: "STV Roldán", number: 21, name: "Irene", position: fieldPlayer, price: 3900 },
  { club: "STV Roldán", number: 8, name: "Mayte Mateo", position: fieldPlayer, price: 5100 },
  { club: "STV Roldán", number: 19, name: "Eva Ardil", position: fieldPlayer, price: 4800 },
  { club: "STV Roldán", number: 28, name: "Rocío", position: fieldPlayer, price: 3400 },
  { club: "STV Roldán", number: 22, name: "María Valverde", position: fieldPlayer, price: 4500 },
  { club: "STV Roldán", number: 14, name: "Alba Andrades", position: fieldPlayer, price: 6200 },
  { club: "STV Roldán", number: 16, name: "Judit", position: fieldPlayer, price: 3700 },
  { club: "STV Roldán", number: 2, name: "Julia", position: fieldPlayer, price: 2900 },
  { club: "STV Roldán", number: 3, name: "Laura", position: fieldPlayer, price: 4200 },
  { club: "STV Roldán", number: 11, name: "Alba Gandía", position: fieldPlayer, price: 5400 },
  { club: "STV Roldán", number: 20, name: "Ángela Górriz", position: fieldPlayer, price: 5800 },
  { club: "STV Roldán", number: 17, name: "Bárbara", position: fieldPlayer, price: 3300 },
];

