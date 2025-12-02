export interface NodeData {
    id: string;
    type: 'editor' | 'note' | 'media';
    x: number;
    y: number;
    width: number;
    height: number;
    content: any;
}
