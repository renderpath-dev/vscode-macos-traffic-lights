import rawRecord from "../../compatibility.json";

export interface CompatibilityRecord {
  readonly criticalSelectors: readonly string[];
  readonly customUiStyleCommit: string;
  readonly customUiStyleVersion: string;
  readonly minimumSupportedVersion: string;
  readonly schemaVersion: 1;
  readonly sourceVerifiedThroughVersion: string;
  readonly sourceVerifiedVscodeCommit: string;
  readonly visuallyTestedVersions: readonly string[];
}

export const compatibilityRecord: CompatibilityRecord = {
  criticalSelectors: rawRecord.criticalSelectors,
  customUiStyleCommit: rawRecord.customUiStyleCommit,
  customUiStyleVersion: rawRecord.customUiStyleVersion,
  minimumSupportedVersion: rawRecord.minimumSupportedVersion,
  schemaVersion: 1,
  sourceVerifiedThroughVersion: rawRecord.sourceVerifiedThroughVersion,
  sourceVerifiedVscodeCommit: rawRecord.sourceVerifiedVscodeCommit,
  visuallyTestedVersions: rawRecord.visuallyTestedVersions,
};
