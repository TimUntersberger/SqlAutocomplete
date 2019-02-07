// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import * as mysql from "mysql"

const databases: any = {}
let selectedDb = "db"

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log(
        'Congratulations, your extension "oracle-sql-autocomplete" is now active!'
    )

    const conn = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "root"
    })

    conn.connect()

    const databasesToIgnore = [
        "information_schema",
        "performance_schema",
        "mysql",
        "sys"
    ]

    const sql = `select * from information_schema.tables tables 
		join information_schema.columns columns on columns.table_name = tables.table_name 
		where ${databasesToIgnore
            .map(db => `columns.table_schema != '${db}'`)
            .join(" and ")};`

    conn.query(sql, (err, result, fields) => {
        for (const combination of result) {
            if (databases[combination.TABLE_SCHEMA] == undefined) {
                databases[combination.TABLE_SCHEMA] = {}
                databases[combination.TABLE_SCHEMA].tables = {}
            }
            const db = databases[combination.TABLE_SCHEMA]
            if (db.tables[combination.TABLE_NAME] == undefined) {
                db.tables[combination.TABLE_NAME] = {}
                db.tables[combination.TABLE_NAME].columns = {}
            }
            const table = db.tables[combination.TABLE_NAME]
            if (table.columns[combination.COLUMN_NAME] == undefined) {
                table.columns[combination.COLUMN_NAME] = {}
            }
        }
        conn.end()
    })

    const keywords = ["select", "from"]

    const autocomplete = vscode.languages.registerCompletionItemProvider(
        "*",
        {
            provideCompletionItems(
                document: vscode.TextDocument,
                position: vscode.Position,
                token: vscode.CancellationToken
            ) {
                const tables = databases[selectedDb].tables
                const completionItems: vscode.CompletionItem[] = []

                Object.keys(tables).forEach(tableKey => {
                    const table = tables[tableKey]

                    completionItems.push(new vscode.CompletionItem(tableKey))

                    Object.keys(table.columns).forEach(columnKey => {
                        completionItems.push(
                            new vscode.CompletionItem(
                                `${tableKey}.${columnKey}`
                            )
                        )
                    })
                })

                keywords.forEach(word =>
                    completionItems.push(new vscode.CompletionItem(word))
                )

                return completionItems
            }
        },
        ""
    )

    const setDb = vscode.commands.registerCommand(
        "oracle-sql-autocomplete.setDb",
        async () => {
            const selectedItem = await vscode.window.showQuickPick(
                Object.keys(databases),
                {
                    canPickMany: false,
                    placeHolder: "Select a database"
                }
            )

            if (selectedItem) selectedDb = selectedItem
        }
    )

    context.subscriptions.push(autocomplete)
    context.subscriptions.push(setDb)
}

// this method is called when your extension is deactivated
export function deactivate() {}