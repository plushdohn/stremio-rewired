export interface Provider {
  getStreams: (
    id: string
  ) => Promise<Array<{ id: string; title: string; url: string }>>;
  search: (
    title: string
  ) => Promise<{ title: string; id: string; imageUrl?: string }[]>;
}
