// Generated 2026-10-14: exercises whose title was the whole task sentence get a short
// title, and that sentence becomes the summary. Keyed by library source_ref. Hand-written fixes in
// text-fixes.js take precedence. Rules: title 2-6 words, summary <= 110 characters, one sentence.
module.exports = {
 "sqlzoo / 9 SELF JOIN / 1": {
  "title": "Count stops",
  "summary": "How many stops are in the database?"
 },
 "sqlzoo / 9 SELF JOIN / 2": {
  "title": "Craiglockhart stop id",
  "summary": "Find the id value for the stop 'Craiglockhart'."
 },
 "sqlzoo / 9 SELF JOIN / 3": {
  "title": "Stops on LRT service 4",
  "summary": "Give the id and the name for the stops on the '4' 'LRT' service."
 },
 "sqltutorialorg / 1 INTRODUCTION TO SQL / 2": {
  "title": "Department names only",
  "summary": "Return only the department_name column from the departments table."
 },
 "sqltutorialorg / 2 QUERYING DATA / 1": {
  "title": "All employee data",
  "summary": "Select every column for every row in the employees table."
 },
 "sqltutorialorg / 2 QUERYING DATA / 2": {
  "title": "Four employee columns",
  "summary": "Select just employee_id, first_name, last_name and hire_date from employees."
 },
 "sqltutorialorg / 2 QUERYING DATA / 6": {
  "title": "Distinct job IDs",
  "summary": "Select the distinct job_id values that appear in the employees table, with no duplicates."
 },
 "sqltutorialorg / 4 LIMITING ROWS / 1": {
  "title": "First five employees",
  "summary": "Show the first 5 rows of the employees table (any columns)."
 },
 "sqltutorialorg / 4 LIMITING ROWS / 2": {
  "title": "Top five salaries",
  "summary": "Show the 5 highest-paid employees (first_name, last_name, salary)."
 },
 "sqltutorialorg / 4 LIMITING ROWS / 4": {
  "title": "Most recent hire",
  "summary": "Show the single most recently hired employee (first_name, last_name, hire_date)."
 },
 "tpointtech / 1 INTRODUCTION TO SQL / 2": {
  "title": "Product names and prices",
  "summary": "Return only product_name and unit_price from products."
 },
 "tpointtech / 3 SELECT BASICS / 1": {
  "title": "All customer data",
  "summary": "Select every column and row from the customers table."
 },
 "tpointtech / 3 SELECT BASICS / 2": {
  "title": "Customer names and email",
  "summary": "Select first_name, last_name and email from customers."
 },
 "w3schools / 1 INTRODUCTION / 1": {
  "title": "All book data",
  "summary": "Return every column and row from the books table in a single statement."
 },
 "w3schools / 1 INTRODUCTION / 2": {
  "title": "Book titles and prices",
  "summary": "Return only title and price from books."
 },
 "w3schools / 2 SELECT BASICS / 1": {
  "title": "Title, genre and price",
  "summary": "Select title, genre and price for every book."
 },
 "tutorialspoint / 1 INTRODUCTION / 3": {
  "title": "All vets data",
  "summary": "Return every column and row from vets in a single statement."
 },
 "sqlcourse / 1 WHAT IS SQL / 1": {
  "title": "What SQL stands for",
  "summary": "Explain in your own words what SQL stands for and what kind of software it talks to."
 },
 "sqlcourse / 2 TABLE BASICS / 2": {
  "title": "Primary keys explained",
  "summary": "Explain what a primary key is, and identify the primary key column in games and in sessions."
 },
 "sqlcourse / 2 TABLE BASICS / 3": {
  "title": "Foreign key explained",
  "summary": "Explain what makes sessions.game_id a foreign key pointing back to games.game_id."
 },
 "sqlcourse / 3 SELECTING DATA / 1": {
  "title": "All games, all columns",
  "summary": "Select every column and row from games."
 },
 "sqlcourse / 3 SELECTING DATA / 2": {
  "title": "Title and category only",
  "summary": "Select only title and category from games."
 },
 "sqlcourse / 3 SELECTING DATA / 4": {
  "title": "Strategy game titles",
  "summary": "Select title from games where category = 'Strategy'."
 },
 "sqlcourse / 3 SELECTING DATA / 5": {
  "title": "Games released after 2015",
  "summary": "Select title and release_year from games where release_year is greater than 2015."
 },
 "sqlcourse / 3 SELECTING DATA / 6": {
  "title": "Meadow Games titles",
  "summary": "Select title from games where publisher = 'Meadow Games'."
 },
 "sqlcourse / 4 CREATING TABLES / 3": {
  "title": "Explain wishlist data types",
  "summary": "Explain, in a comment, why you chose each column's data type in wishlist."
 },
 "sqlcourse / 5 INSERTING DATA / 3": {
  "title": "Record a play session",
  "summary": "Insert a new row into sessions recording a play of the game you added in the earlier exercise."
 },
 "sqlcourse / 5 INSERTING DATA / 4": {
  "title": "Multi-row session insert",
  "summary": "Write a single INSERT statement that adds two new sessions at once."
 },
 "sqlcourse / 6 UPDATING RECORDS / 1": {
  "title": "Update one game's minutes",
  "summary": "Change the play_minutes of game_id 5 to 25."
 },
 "sqlcourse / 6 UPDATING RECORDS / 2": {
  "title": "Rename a publisher",
  "summary": "Change the publisher of every game published by 'Byteworks' to 'Byteworks Studios'."
 },
 "sqlcourse / 6 UPDATING RECORDS / 3": {
  "title": "Add minutes to Strategy games",
  "summary": "Increase play_minutes by 10 for every game in the 'Strategy' category."
 },
 "sqlcourse / 6 UPDATING RECORDS / 4": {
  "title": "Change a session winner",
  "summary": "Change the winner_name of session_id 3 to a name of your choosing."
 },
 "sqlcourse / 6 UPDATING RECORDS / 5": {
  "title": "UPDATE without WHERE",
  "summary": "Explain, in a comment, what happens if you run an UPDATE on games with no WHERE clause."
 },
 "sqlcourse / 7 DELETING RECORDS / 2": {
  "title": "Delete small sessions",
  "summary": "Delete every session with players_count less than 3."
 },
 "sqlcourse / 7 DELETING RECORDS / 3": {
  "title": "Delete Puzzle games",
  "summary": "Delete every game in the 'Puzzle' category."
 },
 "sqlcourse / 8 DROP TABLE / 1": {
  "title": "Drop the wishlist table",
  "summary": "Write the statement that drops the wishlist table you created earlier."
 },
 "sqlcourse / 9 ADVANCED SELECT STATEMENT / 2": {
  "title": "Distinct game categories",
  "summary": "Select every DISTINCT category value from games, with no duplicates."
 },
 "sqlcourse / 9 ADVANCED SELECT STATEMENT / 3": {
  "title": "Distinct Strategy publishers",
  "summary": "Select every DISTINCT publisher that makes games in the 'Strategy' category."
 },
 "sqlcourse / 9 ADVANCED SELECT STATEMENT / 4": {
  "title": "Titles containing 'Market'",
  "summary": "Select title and play_minutes from games where title contains 'Market', using LIKE and a wildcard."
 },
 "sqlcourse / 9 ADVANCED SELECT STATEMENT / 5": {
  "title": "Titles starting with D",
  "summary": "Select title from games where title starts with the letter 'D'."
 },
 "sqlcourse / 11 GROUP BY / 1": {
  "title": "Games per category",
  "summary": "Show category and the number of games in each category."
 },
 "sqlcourse / 11 GROUP BY / 2": {
  "title": "Average play time by publisher",
  "summary": "Show publisher and the average play_minutes of games they publish."
 },
 "sqlcourse / 11 GROUP BY / 4": {
  "title": "Total play minutes per category",
  "summary": "Show category and the total play_minutes summed across all games in that category."
 },
 "sqlcourse / 12 HAVING / 1": {
  "title": "Categories with 3+ games",
  "summary": "Show category and game count, but only for categories with 3 or more games."
 },
 "sqlcourse / 12 HAVING / 3": {
  "title": "Games played at least twice",
  "summary": "Show game_id and session count, joining games to sessions, for games played 2 or more times."
 },
 "sqlcourse / 13 ORDER BY / 2": {
  "title": "Games by newest release",
  "summary": "List games by release_year, most recent first."
 },
 "tutorialrepublic / 1 INTRODUCTION / 2": {
  "title": "Hotel names and cities",
  "summary": "Return only the name and city columns from hotels."
 },
 "mysql:D14-P024": {
  "title": "Attendance rate per grade",
  "summary": "Calculate the attendance rate for each grade."
 },
 "ex-mysql:1.1": {
  "title": "All product names",
  "summary": "Select the names of all the products in the store."
 },
 "ex-mysql:1.2": {
  "title": "Product names and prices",
  "summary": "Select the names and the prices of all the products in the store."
 },
 "ex-mysql:1.3": {
  "title": "Products priced up to $200",
  "summary": "Select the name of the products with a price less than or equal to $200."
 },
 "ex-mysql:1.4": {
  "title": "Products priced $60 to $120",
  "summary": "Select all the products with a price between $60 and $120."
 },
 "ex-mysql:1.6": {
  "title": "Average product price",
  "summary": "Compute the average price of all the products."
 },
 "ex-mysql:1.7": {
  "title": "Average price for manufacturer 2",
  "summary": "Compute the average price of all products with manufacturer code equal to 2."
 },
 "ex-mysql:1.8": {
  "title": "Count products at $180 or more",
  "summary": "Compute the number of products with a price of $180 or more."
 },
 "ex-mysql:1.10": {
  "title": "Products with manufacturer data",
  "summary": "Select all product data, including all the data for each product's manufacturer."
 },
 "ex-mysql:1.11": {
  "title": "Product, price, manufacturer name",
  "summary": "Select the product name, price, and manufacturer name of all the products."
 },
 "ex-mysql:1.12": {
  "title": "Average price by manufacturer code",
  "summary": "Select the average price of each manufacturer's products, showing only the manufacturer's code."
 },
 "ex-mysql:1.13": {
  "title": "Average price by manufacturer name",
  "summary": "Select the average price of each manufacturer's products, showing the manufacturer's name."
 },
 "ex-mysql:1.14": {
  "title": "Manufacturers averaging $150 or more",
  "summary": "Select the names of manufacturers whose products average $150 or more."
 },
 "ex-mysql:1.15": {
  "title": "Cheapest product",
  "summary": "Select the name and price of the cheapest product."
 },
 "ex-mysql:1.16": {
  "title": "Priciest product per manufacturer",
  "summary": "Select each manufacturer's name with the name and price of its most expensive product."
 },
 "ex-mysql:1.18": {
  "title": "Rename product 8",
  "summary": "Update the name of product 8 to \"Laser Printer\"."
 },
 "ex-mysql:1.19": {
  "title": "Discount all products",
  "summary": "Apply a 10% discount to all products."
 },
 "ex-mysql:1.20": {
  "title": "Discount products from $120",
  "summary": "Apply a 10% discount to all products priced at $120 or more."
 },
 "ex-mysql:2.1": {
  "title": "Employee last names",
  "summary": "Select the last name of all employees."
 },
 "ex-mysql:2.2": {
  "title": "Distinct last names",
  "summary": "Select the last name of all employees, without duplicates."
 },
 "ex-mysql:2.3": {
  "title": "Employees named Smith",
  "summary": "Select all the data of employees whose last name is \"Smith\"."
 },
 "ex-mysql:2.4": {
  "title": "Employees named Smith or Doe",
  "summary": "Select all the data of employees whose last name is \"Smith\" or \"Doe\"."
 },
 "ex-mysql:2.5": {
  "title": "Employees in department 14",
  "summary": "Select all the data of employees that work in department 14."
 },
 "ex-mysql:2.6": {
  "title": "Employees in departments 37 and 77",
  "summary": "Select all the data of employees that work in department 37 or 77."
 },
 "ex-mysql:2.7": {
  "title": "Last names starting with S",
  "summary": "Select all the data of employees whose last name begins with an \"S\"."
 },
 "ex-mysql:2.8": {
  "title": "Total department budgets",
  "summary": "Select the sum of all the departments' budgets."
 },
 "ex-mysql:2.9": {
  "title": "Employee count per department",
  "summary": "Select the department code and the number of employees in each department."
 },
 "ex-mysql:2.10": {
  "title": "Employees with department data",
  "summary": "Select all the data of employees, including each employee's department data."
 },
 "ex-mysql:2.11": {
  "title": "Employees with department name and budget",
  "summary": "Select each employee's name and last name with their department's name and budget."
 },
 "ex-mysql:2.12": {
  "title": "Staff of high-budget departments",
  "summary": "Select the name and last name of employees in departments with a budget over $60,000."
 },
 "ex-mysql:2.13": {
  "title": "Above-average budget departments",
  "summary": "Select the departments with a budget larger than the average budget of all departments."
 },
 "ex-mysql:2.14": {
  "title": "Departments with over two employees",
  "summary": "Select the names of departments with more than two employees."
 },
 "ex-mysql:2.15": {
  "title": "Second lowest budget staff",
  "summary": "Select the name and last name of employees in the department with the second lowest budget."
 },
 "ex-mysql:2.17": {
  "title": "Cut department budgets 10%",
  "summary": "Reduce the budget of all departments by 10%."
 },
 "ex-mysql:2.18": {
  "title": "Move Research staff to IT",
  "summary": "Reassign all employees from the Research department (code 77) to the IT department (code 14)."
 },
 "ex-mysql:2.20": {
  "title": "Delete staff in high-budget departments",
  "summary": "Delete all employees who work in departments with a budget of $60,000 or more."
 },
 "ex-mysql:2.21": {
  "title": "Delete all employees",
  "summary": "Delete all employees from the table."
 },
 "ex-mysql:3.1": {
  "title": "All warehouses",
  "summary": "Select all warehouses."
 },
 "ex-mysql:3.2": {
  "title": "Boxes worth over $150",
  "summary": "Select all boxes with a value larger than $150."
 },
 "ex-mysql:3.3": {
  "title": "Distinct box contents",
  "summary": "Select all distinct contents in all the boxes."
 },
 "ex-mysql:3.4": {
  "title": "Average box value",
  "summary": "Select the average value of all the boxes."
 },
 "ex-mysql:3.5": {
  "title": "Average box value per warehouse",
  "summary": "Select the warehouse code and the average value of the boxes in each warehouse."
 },
 "ex-mysql:3.7": {
  "title": "Box codes with city",
  "summary": "Select the code of each box, along with the name of the city the box is located in."
 },
 "ex-mysql:3.10": {
  "title": "Boxes in Chicago",
  "summary": "Select the codes of all the boxes located in Chicago."
 },
 "ex-mysql:3.12": {
  "title": "Insert box H5RT",
  "summary": "Create a new box with code \"H5RT\", containing \"Papers\", valued at $200, in warehouse 2."
 },
 "ex-mysql:3.13": {
  "title": "Cut box values 15%",
  "summary": "Reduce the value of all boxes by 15%."
 },
 "ex-mysql:3.14": {
  "title": "Delete low-value boxes",
  "summary": "Remove all boxes with a value lower than $100."
 },
 "ex-mysql:3.15": {
  "title": "Delete boxes in saturated warehouses",
  "summary": "Remove all boxes from saturated warehouses."
 },
 "ex-mysql:3.17": {
  "title": "List indexes on Boxes",
  "summary": "Print all the existing indexes on table Boxes."
 },
 "ex-mysql:3.18": {
  "title": "Drop the added index",
  "summary": "Remove (drop) the index you added in 3.16."
 },
 "ex-mysql:4.1": {
  "title": "All movie titles",
  "summary": "Select the title of all movies."
 },
 "ex-mysql:4.2": {
  "title": "Distinct movie ratings",
  "summary": "Show all the distinct ratings in the database."
 },
 "ex-mysql:4.3": {
  "title": "Unrated movies",
  "summary": "Show all unrated movies."
 },
 "ex-mysql:4.4": {
  "title": "Theaters with no movie",
  "summary": "Select all movie theaters that are not currently showing a movie."
 },
 "ex-mysql:4.6": {
  "title": "Movies with optional theater",
  "summary": "Select all movie data and, if a movie is shown in a theater, include that theater's data."
 },
 "ex-mysql:4.7": {
  "title": "Movies not in theaters",
  "summary": "Show the titles of movies not currently being shown in any theaters."
 },
 "ex-mysql:4.9": {
  "title": "Rate unrated movies G",
  "summary": "Set the rating of all unrated movies to \"G\"."
 },
 "ex-mysql:4.10": {
  "title": "Delete NC-17 theaters",
  "summary": "Remove movie theaters projecting movies rated \"NC-17\"."
 },
 "ex-mysql:5.1": {
  "title": "Piece names",
  "summary": "Select the name of all the pieces."
 },
 "ex-mysql:5.2": {
  "title": "All provider data",
  "summary": "Select all the providers' data."
 },
 "ex-mysql:5.4": {
  "title": "Providers of piece 1",
  "summary": "Obtain the names of all providers who supply piece 1."
 },
 "ex-mysql:5.5": {
  "title": "Pieces from provider HAL",
  "summary": "Select the name of pieces provided by the provider with code \"HAL\"."
 },
 "ex-mysql:5.7": {
  "title": "Add Skellington sprocket supply",
  "summary": "Add an entry saying \"Skellington Supplies\" (code \"TNBC\") provides sprockets (code \"1\") for 7 cents each."
 },
 "ex-mysql:5.8": {
  "title": "Raise all prices",
  "summary": "Increase all prices by one cent."
 },
 "ex-mysql:6.2": {
  "title": "Unassigned project names",
  "summary": "Select the project names which are not assigned yet."
 },
 "ex-mysql:7.1": {
  "title": "Recipient of 1.5kg package",
  "summary": "Show the name of the client who received a 1.5kg package."
 },
 "ex-mysql:7.2": {
  "title": "Total weight sent",
  "summary": "Find the total weight of all the packages that he sent."
 },
 "ex-mysql:8.7": {
  "title": "Nurses on call for room 123",
  "summary": "Obtain the names of all the nurses who have ever been on call for room 123."
 },
 "ex-mysql:9.1": {
  "title": "Count all recordings",
  "summary": "Give the total number of recordings in this table."
 },
 "ex-mysql:9.2": {
  "title": "Count listed packages",
  "summary": "Count how many packages are listed in this table."
 },
 "ex-mysql:9.3": {
  "title": "Rcpp download count",
  "summary": "Count how many times the package \"Rcpp\" was downloaded."
 },
 "ex-mysql:9.4": {
  "title": "Recordings from China",
  "summary": "Count how many recordings are from China (\"CN\")."
 },
 "ex-mysql:9.8": {
  "title": "Countries out-downloading China",
  "summary": "Print the countries whose downloads are more than the downloads from China (\"CN\")."
 },
 "ex-mysql:9.9": {
  "title": "Average unique package name length",
  "summary": "Print the average length of the package name across all the unique packages."
 },
 "ex-mysql:9.11": {
  "title": "Packages with over 1000 downloads",
  "summary": "Print the name of the packages whose download count is bigger than 1000."
 }
};
