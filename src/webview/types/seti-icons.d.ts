declare module 'seti-icons' {
    export interface IconData {
        svg: string;
        color: string;
    }
    export function getIcon(fileName: string): IconData;
    export function themeIcons(theme: Record<string, string>): (fileName: string) => IconData;
}
