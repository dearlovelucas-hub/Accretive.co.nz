declare module "html-to-docx" {
  interface DocumentOptions {
    table?: { row?: { cantSplit?: boolean } };
    footer?: boolean;
    pageNumber?: boolean;
    [key: string]: unknown;
  }

  function htmlToDocx(
    htmlString: string,
    headerHtmlString: string | null,
    documentOptions?: DocumentOptions,
    footerHtmlString?: string | null
  ): Promise<Buffer | ArrayBuffer | Blob>;

  export default htmlToDocx;
}
