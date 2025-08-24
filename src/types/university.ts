export interface University {
  id: string;
  name: string;
  shortName: string;
  website?: string;
}

export const UNIVERSITIES: University[] = [
  {
    id: 'uga',
    name: 'University of Georgia',
    shortName: 'UGA',
    website: 'https://uga.edu'
  },
  {
    id: 'other',
    name: 'Other University',
    shortName: 'Other'
  }
];

export const DEFAULT_UNIVERSITY_ID = 'uga';
