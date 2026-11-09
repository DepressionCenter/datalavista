## Contributing to DataLaVista

**Thank you for checking out DataLaVista™!**

Please note that this is a off-work hours project my collegues and I develop and maintain primarily in our free time. Because of this, response times to issues, PRs, or messages might vary, but we genuinely appreciate your interest and will get back to you as soon as we can.

### Try the app before making a change

Use Git to clone the project. If you plan to open a pull request, fork the
repository on GitHub and use your fork's clone URL in the first command.

```sh
git clone https://github.com/DepressionCenter/datalavista.git
cd datalavista
git switch -c my-first-change
```

The checkout already contains a working app. From the repository root, start a
local preview with Python 3:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/dist/DataLaVista.html` in your browser.
Keep the terminal open while testing. Press Ctrl+C to stop the server.
If you only want to see the existing app, you can also open
`dist/DataLaVista.html` directly; no build is needed.

### Build and test a source change

Edit the HTML and numbered JavaScript files under `src/`. Rebuild, then reload
the local preview. Run these commands in a second terminal at the repository root:

```sh
bash build.sh
node --check dist/datalavista.js
node --test tests/*.test.cjs
bash tests/check-repository.sh
```

The shell build uses Bash, Python 3 and esbuild. For a first download it also
uses curl and tar. On Windows, run `.\build.ps1` from PowerShell with Git and
tar available. Both scripts can use esbuild from your PATH or download the
pinned version. Node.js runs the tests; it is not needed to view the app.
See [repository maintenance](docs/repository-maintenance.md#application-files-and-builds)
for platform and processor support, and for the four generated files. Keep
changes under `dist/` out of your commit: the publish workflow rebuilds them
after a merge. For a documentation-only change, skip the app build.

### Check one file from upload to saved report

1. Open the local preview and select **Connect + Load**, then **Upload Files**.
   Choose the bundled `samples/data/studies.csv`. Leave the data source name
   blank and select **Connect & Load**.
2. On the **Query** tab, open **SQL Editor** and enter the query below. Select
   **Run Query**. The results should contain one row: `StudyCount` is `500`.

   ```sql
   SELECT COUNT(*) AS StudyCount FROM [Studies_Studies]
   ```

3. Select **Generate Report**, wait for **Report generated!**, then activate
   **Save Local Copy**. Check that the downloaded JSON file contains your query
   in its `sql` field.

There are several ways you can contribute to this project:
### Reporting Bugs
If you find a bug, please open an issue. To help me fix it as quickly as possible, please include the following details:

+ What happened: A clear description of the issue.
+ Steps to reproduce: Exactly what you clicked, typed, or ran to make the bug happen.
+ Replicability: Can you get it to happen consistently, or was it a one-time glitch?
+ Environment details: (e.g., OS, browser, version).

### Sharing Ideas & Features
Do you have an idea to make DataLaVista better? We am absolutely open to suggestions. Feel free to open an issue labeled enhancement or idea to discuss what you have in mind.

### Use Cases, Reports, & Datasets
This is where we could really use your help in the beginning phases! We love hearing how DataLaVista is being used, especially across different industries. You can contribute by sharing:

+ Use Cases & Stories: How are you using the tool? What problems does it solve for you?
+ Example Reports: Have you generated something cool in DataLaVista? Share a screenshot or .json export so others can see what's possible. We would love to feature your work in an examples gallery!
+ Sample Public Datasets: We want to provide great, easy-to-use sample data for newcomers to try out. If you know of (or have put together) interesting, public-domain datasets that work well with DataLaVista, please share them!


Thank you for your time, patience, and contributions! Please keep in mind that all your contributions will need to be under an open source license, to benefit the community.

The DataLaVista™ Project Maintainers
