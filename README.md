# Wagtail Statistics Pulse

A site that scrapes and displays statistics about contributions to the [Wagtail GitHub repository](https://github.com/wagtail/wagtail).

## Development

To run the site locally, you will need to have [Deno](https://deno.land/) installed. Then, you can run the following commands:

```sh
deno run --allow-net --watch fetch.ts
```

## Deployment

This project is hosted on [deno.dev](https://deno.dev/). To deploy, simply push changes to the `main` branch and the site will be automatically updated.

## Credits

This project is a fork of Tom Dyson's [wagtail-pulse](https://github.com/tomdyson/wagtail-pulse), modified to fix broken scraping after a GitHub UI update and to add a HTML view of the data.