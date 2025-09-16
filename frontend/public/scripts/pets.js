import { DEFAULT_STAGE_DETAIL, STAGE_DETAILS } from "./config.js";

export function selectActivePet(user) {
  return user.pets.find((pet) => pet && typeof pet.name === "string" && pet.name.trim()) ?? null;
}

export function getStageDetail(stageValue) {
  const numericStage = Number(stageValue);

  if (Number.isFinite(numericStage) && STAGE_DETAILS[numericStage]) {
    return STAGE_DETAILS[numericStage];
  }

  return DEFAULT_STAGE_DETAIL;
}

export function resolvePetSpecies(pet) {
  if (pet && typeof pet.species === "string") {
    const trimmedSpecies = pet.species.trim();

    if (trimmedSpecies) {
      return trimmedSpecies;
    }
  }

  const stageDetail = getStageDetail(pet?.stage);

  if (stageDetail && typeof stageDetail.species === "string") {
    const trimmedFromStage = stageDetail.species.trim();

    if (trimmedFromStage) {
      return trimmedFromStage;
    }
  }

  return DEFAULT_STAGE_DETAIL.species;
}
