import * as assert from "assert"
import * as pegjs from "pegjs"
import parseSql, { peg } from "../parseSql"

suite("parseSql Tests", function() {
    suite("term tests", function() {
        test(`users u`, function() {
            const parser = pegjs.generate(peg, {
                allowedStartRules: ["tableName"]
            })
            const expected = ["users", "u"]
            const actual = parser.parse("users u")
            assert.deepStrictEqual(actual, expected)
        })
    })

    test(`select * from users;`, function() {
        const expected = ["select", "*", "from", "users", ";"]
        const actual = parseSql("select * from users;")
        assert.deepStrictEqual(actual, expected)
    })

    test(`select name from users;`, function() {
        const expected = ["select", ["name"], "from", "users", ";"]
        const actual = parseSql(`select name from users;`)
        assert.deepStrictEqual(actual, expected)
    })

    test(`select id, name from users;`, function() {
        const expected = ["select", ["id", "name"], "from", "users", ";"]
        const actual = parseSql(`select id, name from users;`)
        assert.deepStrictEqual(actual, expected)
    })

    test(`select id, name from users u;`, function() {
        const expected = ["select", ["id", "name"], "from", ["users", "u"], ";"]
        const actual = parseSql(`select id, name from users u;`)
        assert.deepStrictEqual(actual, expected)
    })

    test(`select id, name from users alias u;`, function() {
        const expected = ["select", ["id", "name"], "from", ["users", "u"], ";"]
        const actual = parseSql(`select id, name from users alias u;`)
        assert.deepStrictEqual(actual, expected)
    })

    test(`select id, name from users u join accounts on id = userId;`, function() {
        const expected = [
            "select",
            ["id", "name"],
            "from",
            ["users", "u"],
            [["join", "accounts", "on", "users.id", "=", "accounts.userId"]],
            ";"
        ]
        const actual = parseSql(
            `select id, name from users u join accounts on users.id = accounts.userId;`
        )
        assert.deepStrictEqual(actual, expected)
    })
})
