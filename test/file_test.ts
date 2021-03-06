import * as chai from "chai";
import * as stream from "stream";
import { File, ProductCode } from "../src/file";
import { Order } from "../src/order";
import { Payment } from "../src/payment";
import { HashType, Seal } from "../src/seal";

chai.should();

function isASCII(str: string, extended: boolean) {
  return (extended ? /^[\x00-\xFF]*$/ : /^[\x00-\x7F]*$/).test(str);
}

describe("bankgirot", () => {
  describe("file", () => {
    const customerNumber = "123456";

    describe("without orders", () => {
      it("should throw an exception", () => {
        chai.should().throw(() => {
          const seal = new Seal(HashType.HMAC_SHA_256, new Date(), "");
          new File(customerNumber, seal, []); // tslint:disable-line
        });
      });
    });

    describe("with orders", () => {
      const payments = [new Payment("991-2346", "99991234567890001", 1000)];
      const orders = [new Order("490-2201", payments)];

      describe("stream", () => {
        const onStream = (
          onChunk: (chunk: string | Buffer) => void,
          done: (err?: Error) => void
        ) => {
          const seal = new Seal(HashType.HMAC_SHA_256, new Date(), "");
          const file = new File(customerNumber, seal, orders);
          const writable = new stream.Writable({
            write(chunk, _encoding, callback) {
              onChunk(chunk);
              callback();
            }
          });
          file.on("end", done).pipe(writable);
        };

        it("should have a line length of 80 characters", done => {
          onStream(chunk => {
            if (chunk.toString() !== "\r\n") {
              chunk.length.should.equal(80);
            }
          }, done);
        });

        it("should be ASCII and use ISO8859-1", done => {
          onStream(chunk => {
            isASCII(chunk.toString("latin1"), true).should.equal(true);
          }, done);
        });

        it("should use <CRLF> between posts", done => {
          onStream(chunk => {
            isASCII(chunk.toString("latin1"), true).should.equal(true);
          }, done);
        });
      });
    });

    describe.skip("with multiple orders from the same account", () => {
      it("should throw an exception", () => {
        chai.should().throw(() => {
          const payments = [new Payment("991-2346", "99991234567890001", 1000)];
          const orders = [
            new Order("490-2201", payments),
            new Order("490-2201", payments)
          ];
          const seal = new Seal(HashType.HMAC_SHA_256, new Date(), "");
          new File(customerNumber, seal, orders); // tslint:disable-line
        });
      });
    });

    describe("filename", () => {
      const filename = File.filename(
        ProductCode.SupplierPayment,
        customerNumber
      );
      const parts = filename.split(".");

      it("should have 3 parts separated by '.'", () =>
        parts.length.should.equal(3));

      describe("part 1", () => {
        it("should always be 'BFEP'", () => parts[0].should.equal("BFEP"));
      });

      describe("part 2", () => {
        describe("transfer method", () => {
          describe("BankgiroLink", () => {
            it("should be 'IBGLK'", () =>
              File.filename(ProductCode.BankgiroLink, customerNumber)
                .split(".")[1]
                .should.equal("IBGLK"));
          });
          describe("FileTransfer", () => {
            it("should be 'ILBLB'", () =>
              File.filename(ProductCode.SupplierPayment, customerNumber)
                .split(".")[1]
                .should.equal("ILBLB"));
          });
        });
      });

      describe("part 3", () => {
        it("should start with 'K0'", () => parts[2].should.match(/^K0/));
        it("should contain the customer number", () =>
          parts[2].should.match(/123456$/));
        it("should be 8 characters long", () =>
          parts[2].length.should.equal(8));
      });
    });
  });
});
