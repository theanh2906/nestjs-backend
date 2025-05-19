#!/usr/bin/env node

// web-crawler.js
'use strict';

const minimist = require('minimist');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { Page, Browser } = require('puppeteer');
const argv = minimist(process.argv.slice(2));
const baseUrl = argv.url || argv.u || '';
const start = argv.start || argv.s || 0;
const end = argv.end || argv.e || 10;
const outputFile = argv.out || argv.o || 'output.json';

const showHelp = () => {
  console.log(
    'Usage: node web-crawler.js --url <base_url> --start <start_index> --end <end_index>'
  );
  console.log(
    'Example: node web-crawler.js --url https://example.com --start 0 --end 10'
  );
};

const crawl = async (url, start, end) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  // await page.goto(url);
  // const content = await page.content();
  // // const $ = cheerio.load(content);
  const data = [];

  for (let i = start; i <= end; i++) {
    await page.goto(url.replace('{page}', i));
    const $ = cheerio.load(await page.content());
    $('.info_chuyengia').each((element) => {
      console.log(element.find('h2').text());
    });
    await crawlEachPage(page, browser);
  }

  console.log(data);

  await browser.close();
  return data;
};

const crawlEachPage = async (_page, _browser) => {
  //TODO: Implement the logic to crawl each page
};

const main = async () => {
  await crawl(baseUrl, start, end);
};

main();
