const fs = require("fs") //import fs from node inbuilt methods
const strip = require("strip-comments") // import strip from strip-comments module

const input = process.argv[2];
const output = process.argv[3];


try {
    let filepath = input // declaring file path from which comments should be stripped

    let file = fs.openSync(filepath, "r+") // Using fs openSync method to open the file

    let data = fs.readFileSync(file, "utf8")// Using fs readFileSync method to read the file

    let strings = strip(data)// Using strip from strip-comments module and passing data

    fs.writeFileSync(output, strings)// Writing the stripped data back to the filepath

    console.log('Comments Removed')

} catch (error) {
    console.log(error)
}

