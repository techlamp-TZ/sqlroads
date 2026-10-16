// The SQL Exercises questions (SQL-exercise-master: Wikibooks "SQL Exercises" sets 1-8, plus the
// repository author's sets 9-10), with a reviewed answer for each one.
//
// The repository's own answer files mix correct answers with deliberately wrong ones ("this query
// would fail"), T-SQL / SQLite / Oracle variants and a few mistakes, so they can't be used as-is
// to check answers. Per question:
//   q       the question (lightly edited: typos, and the detail a checker needs, e.g. rounding)
//   sql     the answer the checker compares with (MySQL; also PostgreSQL unless `pg` is given)
//   pg      the PostgreSQL version, when the dialects differ
//   alts    other correct answers, shown with the solution (and verified by the self-test)
//   accept  other answers that are also marked correct, for questions with more than one
//           right result (e.g. "optionally, include empty warehouses")
//   order   how the rows must be sorted: [[column number, "asc" | "desc"], ...]; rows that tie
//           on those columns may come in any order
//   mode    "results" (default for reads) | "diff" (default for INSERT/UPDATE/DELETE) | "manual"
//   note    what the question teaches / the classic mistake (from the repository's comments)
//   expected  for manual questions: what the learner should see
module.exports = [
  // ---------------------------------------------------------------- 1. The computer store
  { code: "1.1", q: "Select the names of all the products in the store.", sql: "SELECT Name FROM Products;" },
  { code: "1.2", q: "Select the names and the prices of all the products in the store.", sql: "SELECT Name, Price FROM Products;" },
  { code: "1.3", q: "Select the name of the products with a price less than or equal to $200.", sql: "SELECT Name FROM Products WHERE Price <= 200;" },
  {
    code: "1.4",
    q: "Select all the products with a price between $60 and $120.",
    sql: "SELECT * FROM Products WHERE Price BETWEEN 60 AND 120;",
    alts: ["SELECT * FROM Products WHERE Price >= 60 AND Price <= 120;"],
    note: "BETWEEN includes both ends: BETWEEN 60 AND 120 is the same as >= 60 AND <= 120.",
  },
  {
    code: "1.5",
    q: "Select the name and price in cents (i.e., the price must be multiplied by 100).",
    sql: "SELECT Name, Price * 100 FROM Products;",
    alts: ["SELECT Name, Price * 100 AS PriceCents FROM Products;"],
  },
  { code: "1.6", q: "Compute the average price of all the products.", sql: "SELECT AVG(Price) FROM Products;", alts: ["SELECT SUM(Price) / COUNT(Price) FROM Products;"] },
  { code: "1.7", q: "Compute the average price of all products with manufacturer code equal to 2.", sql: "SELECT AVG(Price) FROM Products WHERE Manufacturer = 2;" },
  { code: "1.8", q: "Compute the number of products with a price larger than or equal to $180.", sql: "SELECT COUNT(*) FROM Products WHERE Price >= 180;" },
  {
    code: "1.9",
    q: "Select the name and price of all products with a price larger than or equal to $180, and sort first by price (in descending order), and then by name (in ascending order).",
    sql: "SELECT Name, Price FROM Products WHERE Price >= 180 ORDER BY Price DESC, Name ASC;",
    order: [[2, "desc"], [1, "asc"]],
  },
  {
    code: "1.10",
    q: "Select all the data from the products, including all the data for each product's manufacturer.",
    sql: "SELECT * FROM Products JOIN Manufacturers ON Products.Manufacturer = Manufacturers.Code;",
    alts: ["SELECT P.*, M.* FROM Products P, Manufacturers M WHERE P.Manufacturer = M.Code;"],
  },
  {
    code: "1.11",
    q: "Select the product name, price, and manufacturer name of all the products.",
    sql: "SELECT Products.Name, Price, Manufacturers.Name FROM Products INNER JOIN Manufacturers ON Products.Manufacturer = Manufacturers.Code;",
  },
  {
    code: "1.12",
    q: "Select the average price of each manufacturer's products, showing only the manufacturer's code.",
    sql: "SELECT Manufacturer, AVG(Price) FROM Products GROUP BY Manufacturer;",
  },
  {
    code: "1.13",
    q: "Select the average price of each manufacturer's products, showing the manufacturer's name.",
    sql: "SELECT Manufacturers.Name, AVG(Price) FROM Products JOIN Manufacturers ON Products.Manufacturer = Manufacturers.Code GROUP BY Manufacturers.Name;",
  },
  {
    code: "1.14",
    q: "Select the names of manufacturers whose products have an average price larger than or equal to $150.",
    sql: "SELECT Manufacturers.Name FROM Manufacturers JOIN Products ON Products.Manufacturer = Manufacturers.Code GROUP BY Manufacturers.Name HAVING AVG(Price) >= 150;",
    note: "Filtering on an aggregate (the average) needs HAVING: WHERE runs before the groups exist.",
  },
  {
    code: "1.15",
    q: "Select the name and price of the cheapest product.",
    sql: "SELECT Name, Price FROM Products WHERE Price = (SELECT MIN(Price) FROM Products);",
    alts: ["SELECT Name, Price FROM Products ORDER BY Price ASC LIMIT 1;"],
    note: "ORDER BY ... LIMIT 1 returns one row even when several products share the lowest price; the subquery version returns all of them. (SQL Server writes it SELECT TOP 1 ...)",
  },
  {
    code: "1.16",
    q: "Select the name of each manufacturer along with the name and price of its most expensive product.",
    sql:
      "SELECT M.Name, P.Name, P.Price\nFROM Manufacturers M JOIN Products P ON P.Manufacturer = M.Code\nWHERE P.Price = (SELECT MAX(Price) FROM Products WHERE Manufacturer = M.Code);",
    alts: [
      "SELECT M.Name, P.Name, P.Price\nFROM Products P\nJOIN Manufacturers M ON P.Manufacturer = M.Code\nJOIN (SELECT Manufacturer, MAX(Price) AS MaxPrice FROM Products GROUP BY Manufacturer) T\n  ON T.Manufacturer = P.Manufacturer AND T.MaxPrice = P.Price;",
    ],
    note: "A correlated subquery (it refers to M.Code from the outer query) finds the maximum per manufacturer. GROUP BY alone can't pick the product name that goes with the maximum price.",
  },
  { code: "1.17", q: "Add a new product: Loudspeakers, $70, manufacturer 2 (product code 11).", sql: "INSERT INTO Products VALUES (11, 'Loudspeakers', 70, 2);", alts: ["INSERT INTO Products (Code, Name, Price, Manufacturer) VALUES (11, 'Loudspeakers', 70, 2);"] },
  { code: "1.18", q: "Update the name of product 8 to \"Laser Printer\".", sql: "UPDATE Products SET Name = 'Laser Printer' WHERE Code = 8;" },
  { code: "1.19", q: "Apply a 10% discount to all products.", sql: "UPDATE Products SET Price = Price * 0.9;", note: "Without a WHERE clause, UPDATE changes every row." },
  { code: "1.20", q: "Apply a 10% discount to all products with a price larger than or equal to $120.", sql: "UPDATE Products SET Price = Price * 0.9 WHERE Price >= 120;" },

  // ---------------------------------------------------------------- 2. Employee management
  { code: "2.1", q: "Select the last name of all employees.", sql: "SELECT LastName FROM Employees;" },
  { code: "2.2", q: "Select the last name of all employees, without duplicates.", sql: "SELECT DISTINCT LastName FROM Employees;" },
  { code: "2.3", q: "Select all the data of employees whose last name is \"Smith\".", sql: "SELECT * FROM Employees WHERE LastName = 'Smith';" },
  {
    code: "2.4",
    q: "Select all the data of employees whose last name is \"Smith\" or \"Doe\".",
    sql: "SELECT * FROM Employees WHERE LastName IN ('Smith', 'Doe');",
    alts: ["SELECT * FROM Employees WHERE LastName = 'Smith' OR LastName = 'Doe';"],
  },
  { code: "2.5", q: "Select all the data of employees that work in department 14.", sql: "SELECT * FROM Employees WHERE Department = 14;" },
  { code: "2.6", q: "Select all the data of employees that work in department 37 or department 77.", sql: "SELECT * FROM Employees WHERE Department IN (37, 77);", alts: ["SELECT * FROM Employees WHERE Department = 37 OR Department = 77;"] },
  { code: "2.7", q: "Select all the data of employees whose last name begins with an \"S\".", sql: "SELECT * FROM Employees WHERE LastName LIKE 'S%';" },
  { code: "2.8", q: "Select the sum of all the departments' budgets.", sql: "SELECT SUM(Budget) FROM Departments;" },
  {
    code: "2.9",
    q: "Select the number of employees in each department (you only need to show the department code and the number of employees).",
    sql: "SELECT Department, COUNT(*) FROM Employees GROUP BY Department;",
  },
  {
    code: "2.10",
    q: "Select all the data of employees, including each employee's department's data.",
    sql: "SELECT * FROM Employees E INNER JOIN Departments D ON E.Department = D.Code;",
  },
  {
    code: "2.11",
    q: "Select the name and last name of each employee, along with the name and budget of the employee's department.",
    sql: "SELECT E.Name, E.LastName, D.Name AS DepartmentName, D.Budget FROM Employees E INNER JOIN Departments D ON E.Department = D.Code;",
  },
  {
    code: "2.12",
    q: "Select the name and last name of employees working for departments with a budget greater than $60,000.",
    sql: "SELECT Name, LastName FROM Employees WHERE Department IN (SELECT Code FROM Departments WHERE Budget > 60000);",
    alts: ["SELECT E.Name, E.LastName FROM Employees E INNER JOIN Departments D ON E.Department = D.Code AND D.Budget > 60000;"],
  },
  {
    code: "2.13",
    q: "Select the departments with a budget larger than the average budget of all the departments.",
    sql: "SELECT * FROM Departments WHERE Budget > (SELECT AVG(Budget) FROM Departments);",
  },
  {
    code: "2.14",
    q: "Select the names of departments with more than two employees.",
    sql: "SELECT Name FROM Departments WHERE Code IN (SELECT Department FROM Employees GROUP BY Department HAVING COUNT(*) > 2);",
    alts: ["SELECT D.Name FROM Employees E INNER JOIN Departments D ON E.Department = D.Code GROUP BY D.Name HAVING COUNT(*) > 2;"],
  },
  {
    code: "2.15",
    q: "Select the name and last name of employees working for the department with the second lowest budget.",
    sql:
      "SELECT Name, LastName FROM Employees\nWHERE Department = (\n  SELECT T.Code FROM (SELECT * FROM Departments ORDER BY Budget LIMIT 2) T\n  ORDER BY T.Budget DESC LIMIT 1\n);",
    alts: ["SELECT Name, LastName FROM Employees\nWHERE Department = (SELECT Code FROM Departments ORDER BY Budget LIMIT 1 OFFSET 1);"],
    note: "The repository marks this one \"very important\": take the two cheapest departments, then the more expensive of those two. LIMIT 1 OFFSET 1 does the same in one step.",
  },
  {
    code: "2.16",
    q: "Add a new department called \"Quality Assurance\", with a budget of $40,000 and departmental code 11. Add an employee called \"Mary Moore\" in that department, with SSN 847-21-9811 (store it as the number 847219811).",
    sql: "INSERT INTO Departments VALUES (11, 'Quality Assurance', 40000);\nINSERT INTO Employees VALUES (847219811, 'Mary', 'Moore', 11);",
    note: "The department goes in first: the employee's Department must point at an existing department (foreign key).",
  },
  { code: "2.17", q: "Reduce the budget of all departments by 10%.", sql: "UPDATE Departments SET Budget = 0.9 * Budget;" },
  { code: "2.18", q: "Reassign all employees from the Research department (code 77) to the IT department (code 14).", sql: "UPDATE Employees SET Department = 14 WHERE Department = 77;" },
  { code: "2.19", q: "Delete from the table all employees in the IT department (code 14).", sql: "DELETE FROM Employees WHERE Department = 14;" },
  {
    code: "2.20",
    q: "Delete from the table all employees who work in departments with a budget greater than or equal to $60,000.",
    sql: "DELETE FROM Employees WHERE Department IN (SELECT Code FROM Departments WHERE Budget >= 60000);",
  },
  { code: "2.21", q: "Delete from the table all employees.", sql: "DELETE FROM Employees;", note: "DELETE without WHERE empties the table (the table itself stays). TRUNCATE TABLE does the same faster, but can't be rolled back on MySQL." },

  // ---------------------------------------------------------------- 3. The warehouse
  { code: "3.1", q: "Select all warehouses.", sql: "SELECT * FROM Warehouses;" },
  { code: "3.2", q: "Select all boxes with a value larger than $150.", sql: "SELECT * FROM Boxes WHERE Value > 150;" },
  { code: "3.3", q: "Select all distinct contents in all the boxes.", sql: "SELECT DISTINCT Contents FROM Boxes;" },
  { code: "3.4", q: "Select the average value of all the boxes.", sql: "SELECT AVG(Value) FROM Boxes;" },
  { code: "3.5", q: "Select the warehouse code and the average value of the boxes in each warehouse.", sql: "SELECT Warehouse, AVG(Value) FROM Boxes GROUP BY Warehouse;" },
  {
    code: "3.6",
    q: "Same as the previous exercise, but select only those warehouses where the average value of the boxes is greater than 150.",
    sql: "SELECT Warehouse, AVG(Value) FROM Boxes GROUP BY Warehouse HAVING AVG(Value) > 150;",
  },
  {
    code: "3.7",
    q: "Select the code of each box, along with the name of the city the box is located in.",
    sql: "SELECT Boxes.Code, Warehouses.Location FROM Boxes JOIN Warehouses ON Boxes.Warehouse = Warehouses.Code;",
  },
  {
    code: "3.8",
    q: "Select the warehouse codes, along with the number of boxes in each warehouse. Optionally, take into account that some warehouses are empty (i.e., the box count should show up as zero, instead of omitting the warehouse from the result).",
    sql: "SELECT Warehouse, COUNT(*) FROM Boxes GROUP BY Warehouse;",
    accept: ["SELECT Warehouses.Code, COUNT(Boxes.Code) FROM Warehouses LEFT JOIN Boxes ON Warehouses.Code = Boxes.Warehouse GROUP BY Warehouses.Code;"],
    alts: ["-- The optional version, with empty warehouses counted as 0:\nSELECT Warehouses.Code, COUNT(Boxes.Code) FROM Warehouses LEFT JOIN Boxes ON Warehouses.Code = Boxes.Warehouse GROUP BY Warehouses.Code;"],
    note: "In the LEFT JOIN version, COUNT(Boxes.Code) counts only real boxes; COUNT(*) would count the empty warehouse's NULL row as 1.",
  },
  {
    code: "3.9",
    q: "Select the codes of all warehouses that are saturated (a warehouse is saturated if the number of boxes in it is larger than the warehouse's capacity).",
    sql: "SELECT Code FROM Warehouses WHERE Capacity < (SELECT COUNT(*) FROM Boxes WHERE Warehouse = Warehouses.Code);",
    alts: ["SELECT W.Code FROM Warehouses W JOIN Boxes B ON B.Warehouse = W.Code GROUP BY W.Code, W.Capacity HAVING COUNT(*) > W.Capacity;"],
  },
  {
    code: "3.10",
    q: "Select the codes of all the boxes located in Chicago.",
    sql: "SELECT Boxes.Code FROM Boxes JOIN Warehouses ON Boxes.Warehouse = Warehouses.Code WHERE Warehouses.Location = 'Chicago';",
    alts: ["SELECT Code FROM Boxes WHERE Warehouse IN (SELECT Code FROM Warehouses WHERE Location = 'Chicago');"],
  },
  { code: "3.11", q: "Create a new warehouse in New York with a capacity for 3 boxes (warehouse code 6).", sql: "INSERT INTO Warehouses VALUES (6, 'New York', 3);" },
  { code: "3.12", q: "Create a new box, with code \"H5RT\", containing \"Papers\" with a value of $200, and located in warehouse 2.", sql: "INSERT INTO Boxes VALUES ('H5RT', 'Papers', 200, 2);" },
  { code: "3.13", q: "Reduce the value of all boxes by 15%.", sql: "UPDATE Boxes SET Value = Value * 0.85;" },
  { code: "3.14", q: "Remove all boxes with a value lower than $100.", sql: "DELETE FROM Boxes WHERE Value < 100;" },
  {
    code: "3.15",
    q: "Remove all boxes from saturated warehouses.",
    sql: "DELETE FROM Boxes WHERE Warehouse IN (\n  SELECT Code FROM (\n    SELECT W.Code FROM Warehouses W\n    WHERE W.Capacity < (SELECT COUNT(*) FROM Boxes B WHERE B.Warehouse = W.Code)\n  ) AS Saturated\n);",
    pg: "DELETE FROM Boxes WHERE Warehouse IN (\n  SELECT Code FROM Warehouses\n  WHERE Capacity < (SELECT COUNT(*) FROM Boxes WHERE Warehouse = Warehouses.Code)\n);",
    note: "MySQL refuses a DELETE whose subquery reads the same table (error 1093: \"You can't specify target table 'Boxes' for update in FROM clause\"). Wrapping the subquery in a derived table (AS Saturated) makes MySQL compute it first. PostgreSQL accepts the plain version.",
  },
  {
    code: "3.16",
    q: "Add an index for column \"Warehouse\" in table \"Boxes\". (In practice an index isn't worth it on a table this small.)",
    sql: "CREATE INDEX INDEX_WAREHOUSE ON Boxes (Warehouse);",
    mode: "manual",
    expected: "The statement succeeds. 3.17 then lists INDEX_WAREHOUSE among the indexes of Boxes.",
  },
  {
    code: "3.17",
    q: "Print all the existing indexes on table Boxes.",
    sql: "SHOW INDEX FROM Boxes;",
    pg: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'boxes';",
    mode: "manual",
    expected: "The primary key index, the foreign key index on Warehouse (MySQL creates one automatically) and INDEX_WAREHOUSE if you did 3.16.",
    note: "Each database lists indexes its own way: MySQL SHOW INDEX FROM t; PostgreSQL the pg_indexes view; SQLite .indexes t; Oracle the ALL_INDEXES view.",
  },
  {
    code: "3.18",
    q: "Remove (drop) the index you added in 3.16.",
    sql: "DROP INDEX INDEX_WAREHOUSE ON Boxes;",
    pg: "DROP INDEX index_warehouse;",
    mode: "manual",
    expected: "The statement succeeds and 3.17 no longer lists INDEX_WAREHOUSE.",
    note: "MySQL needs the table (DROP INDEX name ON table); in PostgreSQL index names are unique per schema, so DROP INDEX name is enough.",
  },

  // ---------------------------------------------------------------- 4. Movie theatres
  { code: "4.1", q: "Select the title of all movies.", sql: "SELECT Title FROM Movies;" },
  { code: "4.2", q: "Show all the distinct ratings in the database.", sql: "SELECT DISTINCT Rating FROM Movies;" },
  { code: "4.3", q: "Show all unrated movies.", sql: "SELECT * FROM Movies WHERE Rating IS NULL;", note: "Rating = NULL is never true: NULL means unknown, so compare with IS NULL." },
  { code: "4.4", q: "Select all movie theaters that are not currently showing a movie.", sql: "SELECT * FROM MovieTheaters WHERE Movie IS NULL;" },
  {
    code: "4.5",
    q: "Select all data from all movie theaters and, additionally, the data from the movie that is being shown in the theater (if one is being shown).",
    sql: "SELECT * FROM MovieTheaters LEFT JOIN Movies ON MovieTheaters.Movie = Movies.Code;",
    note: "An inner JOIN would drop the theaters showing nothing; LEFT JOIN keeps every theater and fills the movie columns with NULL.",
  },
  {
    code: "4.6",
    q: "Select all data from all movies and, if that movie is being shown in a theater, show the data from the theater.",
    sql: "SELECT * FROM Movies LEFT JOIN MovieTheaters ON Movies.Code = MovieTheaters.Movie;",
    alts: ["SELECT * FROM MovieTheaters RIGHT JOIN Movies ON MovieTheaters.Movie = Movies.Code;"],
  },
  {
    code: "4.7",
    q: "Show the titles of movies not currently being shown in any theaters.",
    sql: "SELECT Title FROM Movies WHERE Code NOT IN (SELECT Movie FROM MovieTheaters WHERE Movie IS NOT NULL);",
    alts: ["SELECT Movies.Title FROM MovieTheaters RIGHT JOIN Movies ON MovieTheaters.Movie = Movies.Code WHERE MovieTheaters.Movie IS NULL;"],
    note: "The repository calls this one VERY IMPORTANT: NOT IN (SELECT Movie FROM MovieTheaters) returns no rows at all, because one theater's Movie is NULL and \"x NOT IN (..., NULL)\" is never true. Filter the NULLs out, or use NOT EXISTS / a LEFT JOIN.",
  },
  {
    code: "4.8",
    q: "Add the unrated movie \"One, Two, Three\" (let the database pick its code).",
    sql: "INSERT INTO Movies (Title, Rating) VALUES ('One, Two, Three', NULL);",
  },
  { code: "4.9", q: "Set the rating of all unrated movies to \"G\".", sql: "UPDATE Movies SET Rating = 'G' WHERE Rating IS NULL;" },
  {
    code: "4.10",
    q: "Remove movie theaters projecting movies rated \"NC-17\".",
    sql: "DELETE FROM MovieTheaters WHERE Movie IN (SELECT Code FROM Movies WHERE Rating = 'NC-17');",
  },

  // ---------------------------------------------------------------- 5. Pieces and providers
  { code: "5.1", q: "Select the name of all the pieces.", sql: "SELECT Name FROM Pieces;" },
  { code: "5.2", q: "Select all the providers' data.", sql: "SELECT * FROM Providers;" },
  { code: "5.3", q: "Obtain the average price of each piece (show only the piece code and the average price).", sql: "SELECT Piece, AVG(Price) FROM Provides GROUP BY Piece;" },
  {
    code: "5.4",
    q: "Obtain the names of all providers who supply piece 1.",
    sql: "SELECT Name FROM Providers WHERE Code IN (SELECT Provider FROM Provides WHERE Piece = 1);",
    alts: ["SELECT Providers.Name FROM Providers INNER JOIN Provides ON Providers.Code = Provides.Provider AND Provides.Piece = 1;"],
  },
  {
    code: "5.5",
    q: "Select the name of pieces provided by provider with code \"HAL\".",
    sql: "SELECT Name FROM Pieces WHERE Code IN (SELECT Piece FROM Provides WHERE Provider = 'HAL');",
    alts: ["SELECT Name FROM Pieces WHERE EXISTS (SELECT * FROM Provides WHERE Provider = 'HAL' AND Piece = Pieces.Code);"],
  },
  {
    code: "5.6",
    q: "For each piece, find the most expensive offering of that piece and include the piece name, provider name, and price (note that there could be two providers who supply the same piece at the most expensive price).",
    sql:
      "SELECT Pieces.Name, Providers.Name, Price\nFROM Pieces INNER JOIN Provides ON Pieces.Code = Piece\n            INNER JOIN Providers ON Providers.Code = Provider\nWHERE Price = (SELECT MAX(Price) FROM Provides WHERE Piece = Pieces.Code);",
    note: "The repository author's first try, GROUP BY piece with the provider name in the SELECT, is wrong: it shows an arbitrary provider per piece, not the one with the top price (MySQL 8 rejects it with ONLY_FULL_GROUP_BY). Compare each offer with its piece's maximum instead.",
  },
  {
    code: "5.7",
    q: "Add an entry to the database to indicate that \"Skellington Supplies\" (code \"TNBC\") will provide sprockets (code \"1\") for 7 cents each.",
    sql: "INSERT INTO Provides (Piece, Provider, Price) VALUES (1, 'TNBC', 7);",
  },
  { code: "5.8", q: "Increase all prices by one cent.", sql: "UPDATE Provides SET Price = Price + 1;" },
  {
    code: "5.9",
    q: "Update the database to reflect that \"Susan Calvin Corp.\" (code \"RBT\") will not supply bolts (code 4).",
    sql: "DELETE FROM Provides WHERE Provider = 'RBT' AND Piece = 4;",
  },
  {
    code: "5.10",
    q: "Update the database to reflect that \"Susan Calvin Corp.\" (code \"RBT\") will not supply any pieces (the provider should still remain in the database).",
    sql: "DELETE FROM Provides WHERE Provider = 'RBT';",
  },

  // ---------------------------------------------------------------- 6. Scientists
  {
    code: "6.1",
    q: "List all the scientists' names, their projects' names, and the hours worked by that scientist on each project, in alphabetical order of project name, then scientist name.",
    sql:
      "SELECT S.Name, P.Name, P.Hours\nFROM Scientists S\n  INNER JOIN AssignedTo A ON S.SSN = A.Scientist\n  INNER JOIN Projects P ON A.Project = P.Code\nORDER BY P.Name ASC, S.Name ASC;",
    order: [[2, "asc"], [1, "asc"]],
  },
  {
    code: "6.2",
    q: "Select the project names which are not assigned yet.",
    sql: "SELECT Name FROM Projects WHERE Code NOT IN (SELECT Project FROM AssignedTo);",
    alts: ["SELECT P.Name FROM Projects P LEFT JOIN AssignedTo A ON A.Project = P.Code WHERE A.Project IS NULL;"],
  },

  // ---------------------------------------------------------------- 7. Planet Express
  {
    code: "7.1",
    q: "Who received a 1.5kg package? (Show the client's name.)",
    sql: "SELECT Client.Name FROM Client JOIN Package ON Client.AccountNumber = Package.Recipient WHERE Package.Weight = 1.5;",
    note: "The answer is \"Al Gore's Head\". Package.Recipient is only an account number: join Client to get the name.",
  },
  {
    code: "7.2",
    q: "What is the total weight of all the packages that he sent?",
    sql: "SELECT SUM(P.Weight) FROM Client C JOIN Package P ON C.AccountNumber = P.Sender WHERE C.Name = 'Al Gore''s Head';",
    alts: ["SELECT SUM(Weight) FROM Package WHERE Sender = (SELECT Recipient FROM Package WHERE Weight = 1.5);"],
    note: "A quote inside a string is doubled: 'Al Gore''s Head'. MySQL also accepts \"Al Gore's Head\", but in PostgreSQL and standard SQL double quotes name a column, not a string.",
  },

  // ---------------------------------------------------------------- 8. Hospital
  {
    code: "8.1",
    q: "Obtain the names of all physicians that have performed a medical procedure they have never been certified to perform.",
    sql: "SELECT Name FROM Physician\nWHERE EmployeeID IN (\n  SELECT Physician FROM Undergoes U\n  WHERE NOT EXISTS (SELECT * FROM Trained_In WHERE Treatment = Procedures AND Physician = U.Physician)\n);",
  },
  {
    code: "8.2",
    q: "Same as the previous query, but include the following information in the results: physician name, name of procedure, date when the procedure was carried out, name of the patient the procedure was carried out on.",
    sql:
      "SELECT P.Name AS Physician, Pr.Name AS `Procedure`, U.DateUndergoes, Pt.Name AS Patient\nFROM Physician P, Undergoes U, Patient Pt, Procedures Pr\nWHERE U.Patient = Pt.SSN\n  AND U.Procedures = Pr.Code\n  AND U.Physician = P.EmployeeID\n  AND NOT EXISTS (SELECT * FROM Trained_In T WHERE T.Treatment = U.Procedures AND T.Physician = U.Physician);",
    pg:
      "SELECT P.Name AS Physician, Pr.Name AS Procedure, U.DateUndergoes, Pt.Name AS Patient\nFROM Physician P, Undergoes U, Patient Pt, Procedures Pr\nWHERE U.Patient = Pt.SSN\n  AND U.Procedures = Pr.Code\n  AND U.Physician = P.EmployeeID\n  AND NOT EXISTS (SELECT * FROM Trained_In T WHERE T.Treatment = U.Procedures AND T.Physician = U.Physician);",
    note: "PROCEDURE is a reserved word in MySQL, so the alias needs backticks there.",
  },
  {
    code: "8.3",
    q: "Obtain the names of all physicians that have performed a medical procedure that they are certified to perform, but such that the procedure was done at a date (Undergoes.DateUndergoes) after the physician's certification expired (Trained_In.CertificationExpires).",
    sql: "SELECT P.Name\nFROM Physician P, Trained_In T, Undergoes U\nWHERE T.Physician = U.Physician\n  AND T.Treatment = U.Procedures\n  AND U.DateUndergoes > T.CertificationExpires\n  AND P.EmployeeID = U.Physician;",
    accept: [
      "SELECT DISTINCT P.Name\nFROM Physician P, Trained_In T, Undergoes U\nWHERE T.Physician = U.Physician AND T.Treatment = U.Procedures AND U.DateUndergoes > T.CertificationExpires AND P.EmployeeID = U.Physician;",
    ],
  },
  {
    code: "8.4",
    q: "Same as the previous query, but include the following information in the results: physician name, name of procedure, date when the procedure was carried out, name of the patient the procedure was carried out on, and date when the certification expired.",
    sql:
      "SELECT P.Name AS Physician, Pr.Name AS `Procedure`, U.DateUndergoes, Pt.Name AS Patient, T.CertificationExpires\nFROM Physician P, Undergoes U, Patient Pt, Procedures Pr, Trained_In T\nWHERE U.Patient = Pt.SSN\n  AND U.Procedures = Pr.Code\n  AND U.Physician = P.EmployeeID\n  AND Pr.Code = T.Treatment\n  AND P.EmployeeID = T.Physician\n  AND U.DateUndergoes > T.CertificationExpires;",
    pg:
      "SELECT P.Name AS Physician, Pr.Name AS Procedure, U.DateUndergoes, Pt.Name AS Patient, T.CertificationExpires\nFROM Physician P, Undergoes U, Patient Pt, Procedures Pr, Trained_In T\nWHERE U.Patient = Pt.SSN\n  AND U.Procedures = Pr.Code\n  AND U.Physician = P.EmployeeID\n  AND Pr.Code = T.Treatment\n  AND P.EmployeeID = T.Physician\n  AND U.DateUndergoes > T.CertificationExpires;",
  },
  {
    code: "8.5",
    q: "Obtain the information for appointments where a patient met with a physician other than his/her primary care physician. Show the following information: patient name, physician name, nurse name (if any), start and end time of appointment, examination room, and the name of the patient's primary care physician.",
    sql:
      "SELECT Pt.Name AS Patient, Ph.Name AS Physician, N.Name AS Nurse, A.Start, A.End, A.ExaminationRoom, PhPCP.Name AS PCP\nFROM Appointment A\n  JOIN Patient Pt ON A.Patient = Pt.SSN\n  JOIN Physician Ph ON A.Physician = Ph.EmployeeID\n  JOIN Physician PhPCP ON Pt.PCP = PhPCP.EmployeeID\n  LEFT JOIN Nurse N ON A.PrepNurse = N.EmployeeID\nWHERE A.Physician <> Pt.PCP;",
    pg:
      "SELECT Pt.Name AS Patient, Ph.Name AS Physician, N.Name AS Nurse, A.Start, A.\"end\", A.ExaminationRoom, PhPCP.Name AS PCP\nFROM Appointment A\n  JOIN Patient Pt ON A.Patient = Pt.SSN\n  JOIN Physician Ph ON A.Physician = Ph.EmployeeID\n  JOIN Physician PhPCP ON Pt.PCP = PhPCP.EmployeeID\n  LEFT JOIN Nurse N ON A.PrepNurse = N.EmployeeID\nWHERE A.Physician <> Pt.PCP;",
    note: "\"if any\" means a LEFT JOIN to Nurse: appointments without a prep nurse must stay. In PostgreSQL END is a reserved word: it works after a table alias (A.End) but on its own must be quoted (\"end\").",
  },
  {
    code: "8.6",
    q: "The Patient field in Undergoes is redundant, since we can obtain it from the Stay table. There are no constraints in force to prevent inconsistencies between these two tables. More specifically, the Undergoes table may include a row where the patient ID does not match the one we would obtain from the Stay table through the Undergoes.Stay foreign key. Select all rows from Undergoes that exhibit this inconsistency.",
    sql: "SELECT * FROM Undergoes U WHERE Patient <> (SELECT Patient FROM Stay S WHERE U.Stay = S.StayID);",
  },
  {
    code: "8.7",
    q: "Obtain the names of all the nurses who have ever been on call for room 123.",
    sql: "SELECT N.Name FROM Nurse N\nWHERE EmployeeID IN (\n  SELECT OC.Nurse FROM On_Call OC, Room R\n  WHERE OC.BlockFloor = R.BlockFloor AND OC.BlockCode = R.BlockCode AND R.RoomNumber = 123\n);",
    note: "Nurses are on call for a block (floor + code), not for a room: join On_Call to Room on both block columns.",
  },
  {
    code: "8.8",
    q: "The hospital has several examination rooms where appointments take place. Obtain the number of appointments that have taken place in each examination room.",
    sql: "SELECT ExaminationRoom, COUNT(AppointmentID) AS Number FROM Appointment GROUP BY ExaminationRoom;",
  },
  {
    code: "8.9",
    q: "Obtain the names of all patients (also include, for each patient, the name of the patient's primary care physician), such that all the following are true:\n- The patient has been prescribed some medication by his/her primary care physician.\n- The patient has undergone a procedure with a cost larger than $5,000.\n- The patient has had at least two appointments where the nurse who prepped the appointment was a registered nurse.\n- The patient's primary care physician is not the head of any department.",
    sql:
      "SELECT Pt.Name, PhPCP.Name\nFROM Patient Pt, Physician PhPCP\nWHERE Pt.PCP = PhPCP.EmployeeID\n  AND EXISTS (SELECT * FROM Prescribes Pr WHERE Pr.Patient = Pt.SSN AND Pr.Physician = Pt.PCP)\n  AND EXISTS (SELECT * FROM Undergoes U, Procedures Pr WHERE U.Procedures = Pr.Code AND U.Patient = Pt.SSN AND Pr.Cost > 5000)\n  AND 2 <= (SELECT COUNT(A.AppointmentID) FROM Appointment A, Nurse N\n            WHERE A.PrepNurse = N.EmployeeID AND N.Registered AND A.Patient = Pt.SSN)\n  AND Pt.PCP NOT IN (SELECT Head FROM Department);",
    note: "Each condition is its own subquery. The repository's answer forgets A.Patient = Pt.SSN in the appointment count, so it counts every patient's appointments; this version counts only the patient's own.",
  },

  // ---------------------------------------------------------------- 9. CRAN package downloads
  { code: "9.1", q: "Give the total number of recordings in this table.", sql: "SELECT COUNT(*) FROM cran_logs_2015_01_01;" },
  { code: "9.2", q: "How many packages are listed in this table?", sql: "SELECT COUNT(DISTINCT package) FROM cran_logs_2015_01_01;" },
  { code: "9.3", q: "How many times was the package \"Rcpp\" downloaded?", sql: "SELECT COUNT(*) FROM cran_logs_2015_01_01 WHERE package = 'Rcpp';" },
  { code: "9.4", q: "How many recordings are from China (\"CN\")?", sql: "SELECT COUNT(*) FROM cran_logs_2015_01_01 WHERE country = 'CN';" },
  {
    code: "9.5",
    q: "Give the package name and how many times it was downloaded. Order by the 2nd column, descending.",
    sql: "SELECT package, COUNT(*) FROM cran_logs_2015_01_01 GROUP BY package ORDER BY 2 DESC;",
    order: [[2, "desc"]],
    note: "ORDER BY 2 sorts by the second column of the SELECT list; ORDER BY COUNT(*) DESC says the same thing more readably.",
  },
  {
    code: "9.6",
    q: "Give the package ranking (based on how many times it was downloaded) for downloads from 9 AM up to (not including) 11 AM.",
    sql: "SELECT package, COUNT(*) FROM cran_logs_2015_01_01\nWHERE time >= '09:00:00' AND time < '11:00:00'\nGROUP BY package\nORDER BY 2 DESC;",
    order: [[2, "desc"]],
    note: "The repository compares SUBSTR(time, 1, 5) as text, which works on MySQL but leaves out 09:00:xx. With a TIME column, compare times directly: >= start AND < end includes everything from 9:00:00 to 10:59:59.",
  },
  {
    code: "9.7",
    q: "How many recordings are from China (\"CN\"), Japan (\"JP\") or Singapore (\"SG\")? Select based on a given list.",
    sql: "SELECT COUNT(*) FROM cran_logs_2015_01_01 WHERE country IN ('CN', 'JP', 'SG');",
    alts: ["SELECT COUNT(*) FROM cran_logs_2015_01_01 WHERE country = 'CN' OR country = 'JP' OR country = 'SG';"],
  },
  {
    code: "9.8",
    q: "Print the countries whose downloads are more than the downloads from China (\"CN\").",
    sql: "SELECT country FROM cran_logs_2015_01_01\nGROUP BY country\nHAVING COUNT(*) > (SELECT COUNT(*) FROM cran_logs_2015_01_01 WHERE country = 'CN');",
    alts: [
      "SELECT TEMP.country\nFROM (SELECT country, COUNT(*) AS downloads FROM cran_logs_2015_01_01 GROUP BY country) AS TEMP\nWHERE TEMP.downloads > (SELECT COUNT(*) FROM cran_logs_2015_01_01 WHERE country = 'CN');",
    ],
  },
  {
    code: "9.9",
    q: "Print the average length of the package name of all the UNIQUE packages.",
    sql: "SELECT AVG(LENGTH(package)) FROM (SELECT DISTINCT package FROM cran_logs_2015_01_01) AS T;",
    note: "AVG(LENGTH(package)) over the whole table is the classic mistake: it averages per download, so popular packages count many times. Take the DISTINCT packages first.",
  },
  {
    code: "9.10",
    q: "Get the package whose download count ranks 2nd (print the package name and its download count).",
    sql: "SELECT T.package, T.downloads\nFROM (SELECT package, COUNT(*) AS downloads FROM cran_logs_2015_01_01 GROUP BY package ORDER BY downloads DESC LIMIT 2) AS T\nORDER BY T.downloads ASC\nLIMIT 1;",
    alts: ["SELECT package, COUNT(*) FROM cran_logs_2015_01_01 GROUP BY package ORDER BY COUNT(*) DESC LIMIT 1 OFFSET 1;"],
  },
  {
    code: "9.11",
    q: "Print the name of the packages whose download count is bigger than 1000.",
    sql: "SELECT package FROM cran_logs_2015_01_01 GROUP BY package HAVING COUNT(*) > 1000;",
    alts: ["SELECT T.package FROM (SELECT package, COUNT(*) AS downloads FROM cran_logs_2015_01_01 GROUP BY package) AS T WHERE T.downloads > 1000;"],
  },
  {
    code: "9.12",
    q: "The field \"r_os\" is the operating system of the users. Show the main systems (ignore the version number: use the first 5 characters of r_os), the number of downloads for each, and their share of all downloads as a percentage rounded to 2 decimals.",
    sql: "SELECT SUBSTR(r_os, 1, 5) AS os,\n       COUNT(*) AS downloads,\n       ROUND(100 * COUNT(*) / (SELECT COUNT(*) FROM cran_logs_2015_01_01), 2) AS percentage\nFROM cran_logs_2015_01_01\nGROUP BY SUBSTR(r_os, 1, 5);",
    pg: "SELECT SUBSTR(r_os, 1, 5) AS os,\n       COUNT(*) AS downloads,\n       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM cran_logs_2015_01_01), 2) AS percentage\nFROM cran_logs_2015_01_01\nGROUP BY SUBSTR(r_os, 1, 5);",
    note: "In PostgreSQL (and SQLite) integer / integer drops the fraction, so 100.0 * makes it a decimal division; MySQL's / always returns a decimal. Downloads with no r_os (NA in the CSV) form their own NULL group.",
  },

  // ---------------------------------------------------------------- 10. People and address history
  {
    code: "10.1",
    q: "Join table PEOPLE and ADDRESS, but keep only one address for each person (we don't mind which record we take for each person). The joined table should have the same number of rows as table PEOPLE.",
    sql: "SELECT PEOPLE.id, PEOPLE.name, T.address\nFROM PEOPLE\nLEFT JOIN (SELECT id, MAX(address) AS address FROM ADDRESS GROUP BY id) AS T\n  ON PEOPLE.id = T.id;",
    mode: "manual",
    expected: "4 rows, one per person (ids 1-4), each with one of that person's addresses.",
    note: "Any address per person is fine, so this one isn't checked automatically. Joining ADDRESS directly gives one row per address (10 rows); grouping ADDRESS first gives one per person.",
  },
  {
    code: "10.2",
    q: "Join table PEOPLE and ADDRESS, but ONLY keep the LATEST address information for each person. The joined table should have the same number of rows as table PEOPLE.",
    sql: "SELECT P.id, P.name, A.address\nFROM PEOPLE P\nLEFT JOIN ADDRESS A\n  ON A.id = P.id\n AND A.updatedate = (SELECT MAX(updatedate) FROM ADDRESS WHERE id = P.id);",
    alts: [
      "SELECT P.id, P.name, A.address\nFROM PEOPLE P\nLEFT JOIN (\n  SELECT id, address, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updatedate DESC) AS rn FROM ADDRESS\n) A ON A.id = P.id AND A.rn = 1;",
    ],
    note: "The repository's SQLite answer (SELECT id, address, MAX(updatedate) ... GROUP BY id) relies on a SQLite quirk; MySQL 8 and PostgreSQL reject it, and elsewhere it may pair the max date with the wrong address. Match each address against the person's latest date, or number the rows with ROW_NUMBER().",
  },
];
