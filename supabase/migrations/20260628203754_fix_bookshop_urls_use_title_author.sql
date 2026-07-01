UPDATE books
SET bookshop_url = 'https://bookshop.org/beta-search?keywords=' || replace(title || ' ' || author, ' ', '+');
