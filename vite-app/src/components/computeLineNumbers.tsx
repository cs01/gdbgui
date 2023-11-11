import { SourceFile } from "./types";

type OriginalLineNumber = string;
type NewToOriginalMapping = { [mixedLineNumber: number]: OriginalLineNumber | "" };
type OriginalToNewMapping = { [lineNumber: number]: number };
type SourceLineTransform = {
  newToOriginal: NewToOriginalMapping;
  originalToNew: OriginalToNewMapping;
};

const sourceLineTransforms = new Map<string, SourceLineTransform>();

function computeSourceAndAsmLineNumber(sourceFile: SourceFile): SourceLineTransform {
  const code = sourceFile.sourceCode;
  const mapping: SourceLineTransform = { newToOriginal: {}, originalToNew: {} };

  let renderedLineNumber = 0;

  code.forEach((_line, realLineNumber: number) => {
    renderedLineNumber += 1;
    mapping.originalToNew[realLineNumber] = renderedLineNumber; // used to highlight the effective line number

    const asmsCurLine = sourceFile.assembly[realLineNumber];
    mapping.newToOriginal[renderedLineNumber] = `${realLineNumber}`;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _asm of asmsCurLine ?? []) {
      mapping.newToOriginal[renderedLineNumber] = "";
      renderedLineNumber += 1;
    }
  });
  return mapping;
}

export function getEffectiveLineNumberWithAsm(
  sourceFile: SourceFile,
  lineNumber: number
): string {
  const mapping = sourceLineTransforms.get(sourceFile.fullname);
  if (mapping) {
    return mapping.newToOriginal[lineNumber];
  }
  const newMapping = computeSourceAndAsmLineNumber(sourceFile);
  sourceLineTransforms.set(sourceFile.fullname, newMapping);
  return newMapping.newToOriginal[lineNumber];
}

export function getHighlightLineFromNewNumber(
  sourceFile: SourceFile,
  lineNumber: number
): number {
  const mapping = sourceLineTransforms.get(sourceFile.fullname);
  if (mapping) {
    return mapping.originalToNew[lineNumber];
  }
  const newMapping = computeSourceAndAsmLineNumber(sourceFile);
  sourceLineTransforms.set(sourceFile.fullname, newMapping);
  return newMapping.originalToNew[lineNumber];
}
