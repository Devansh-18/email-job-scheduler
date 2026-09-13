import Papa from 'papaparse';

export interface CSVParseResult {
  validEmails: string[];
  totalExtracted: number;
  uniqueCount: number;
  duplicateCount: number;
  summaryText: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const parseLeadFile = (file: File): Promise<CSVParseResult> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const extracted: string[] = [];

        results.data.forEach((row: any) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              if (typeof cell === 'string') {
                const trimmed = cell.trim().toLowerCase();
                if (EMAIL_REGEX.test(trimmed)) {
                  extracted.push(trimmed);
                }
              }
            });
          } else if (typeof row === 'string') {
            const trimmed = row.trim().toLowerCase();
            if (EMAIL_REGEX.test(trimmed)) {
              extracted.push(trimmed);
            }
          } else if (typeof row === 'object' && row !== null) {
            Object.values(row).forEach((cell: any) => {
              if (typeof cell === 'string') {
                const trimmed = cell.trim().toLowerCase();
                if (EMAIL_REGEX.test(trimmed)) {
                  extracted.push(trimmed);
                }
              }
            });
          }
        });

        const uniqueSet = new Set<string>();
        let duplicateCount = 0;

        extracted.forEach((email) => {
          if (uniqueSet.has(email)) {
            duplicateCount++;
          } else {
            uniqueSet.add(email);
          }
        });

        const validEmails = Array.from(uniqueSet);
        const summaryText = `Found ${validEmails.length} valid email address${validEmails.length === 1 ? '' : 'es'} (${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'} removed)`;

        resolve({
          validEmails,
          totalExtracted: extracted.length,
          uniqueCount: validEmails.length,
          duplicateCount,
          summaryText,
        });
      },
      error: (err) => {
        reject(err);
      },
    });
  });
};
