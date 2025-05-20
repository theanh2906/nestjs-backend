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
  const data = [];

  for (let i = start; i <= end; i++) {
    await page.goto(url.replace('{page}', i), {
      waitUntil: 'networkidle2',
      timeout: 100000, // 60 seconds timeout
    });
    const $ = cheerio.load(await page.content());
    // Doctor name
    $('.info_chuyengia').each((index, element) => {
      const name = $(element).find('h2').text();
      const position = $(element)
        .find('.font_helI')
        .contents()
        .filter(function () {
          return this.nodeType === 3;
        })
        .text()
        .trim();
      data.push({
        name,
        position,
      });
    });
    // Doctor image
    $('.thumb_cgia').each((index, element) => {
      const imgSrc = $(element).find('img').attr('src');
      const mappingName = $(element).find('img').attr('alt');
      data.filter((item) => item.name === mappingName)[0].img_src = imgSrc;
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
  const doctorData = await crawl(baseUrl, start, end);
  writeToFile(doctorData);
  process.exit(0);
};

const writeToFile = (data) => {
  const fs = require('fs');
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf-8');
};

main();
