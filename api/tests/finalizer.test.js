const finalizer = require('../business-logic/finalization/finalizer'),
    storageLayer = require('../storage/storage-layer'),
    {setCallbackHandler} = require('../business-logic/finalization/callback-handler'),
    {setSubmitTransactionCallback} = require('../business-logic/finalization/horizon-handler')

test('high-level finalizer logic', async () => {
    await storageLayer.initDataProvider('inmemory')
    await storageLayer.dataProvider.saveTransaction({
        'hash': '89d6c423a51e030b392f0e7505e9f3b66be11cb1477aecda79a34e5ae61060e4',
        'network': 1,
        'xdr': 'AAAAAgAAAABTWgh1bRm6Aksd3hHdZ0hlVxDTTfqfP2kfxwVWAsCDjgAAAGQAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAABTWgh1bRm6Aksd3hHdZ0hlVxDTTfqfP2kfxwVWAsCDjgAAAAAAAAAAAJiWgAAAAAAAAAAA',
        'signatures': [
            {
                'key': 'GBJVUCDVNUM3UASLDXPBDXLHJBSVOEGTJX5J6P3JD7DQKVQCYCBY5PP2',
                'signature': 'b1N3ZHZIjuxU+5Fgz1Kj65FntxUOK4V8fxePNmoIc1J5DESkBcPzWTs8ULLldhnqJo6I4+L+xSzZt8+yiwQDBQ=='
            },
            {
                'key': 'GDNMOFMXT7ZGAN3SV5LBYYJVYEUPM5LQWL2NF2WW7JFG4LQLRFU2MQ3I',
                'signature': 'Bj2HCKG7UejTGwN2Dg6seQis+m1Jy0HfKBlQQIoJKHTlnpHpWgcQ0W0UOmmflLl3/zWnl7yzp7Douo3+4tNeAg=='
            }
        ],
        'submit': true,
        'minTime': 0,
        'status': 'ready'
    })
    await storageLayer.dataProvider.saveTransaction({
        'hash': 'd7e4f7cb585b517ec198afcb5f8501ac8aafda64d43150e2852de37cd577c772',
        'network': 1,
        'xdr': 'AAAAAgAAAABTWgh1bRm6Aksd3hHdZ0hlVxDTTfqfP2kfxwVWAsCDjgAAAGQACCbgAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAADaxxWXn/JgN3KvVhxhNcEo9nVwsvTS6tb6Sm4uC4lppgAAAAAAAAAAAJiWgAAAAAAAAAAA',
        'signatures': [
            {
                'key': 'GDNMOFMXT7ZGAN3SV5LBYYJVYEUPM5LQWL2NF2WW7JFG4LQLRFU2MQ3I',
                'signature': 'QuXBu82h+stfWPblpopKrf1K6atdDQlEIFA55X+HIgco4x7Ex8S+APlCeIuqeS1o3IB4rl20tRtoUuSVibTECw=='
            },
            {
                'key': 'GBJVUCDVNUM3UASLDXPBDXLHJBSVOEGTJX5J6P3JD7DQKVQCYCBY5PP2',
                'signature': 'gPChxAzbKmUILh+j6cM3g4d2DBxnSydZIVAZfTE3+3HP53s3f+IXezGf76tpb2E7PfAsSHwyj2GkAbA1KmUhAA=='
            }
        ],
        'callbackUrl': 'https://postman-echo.com/',
        'minTime': 0,
        'status': 'ready'
    })
    await storageLayer.dataProvider.saveTransaction({
        'hash': 'e59a325bad4dec41bdbee7c172663164c98d768ce6861c3ea6f4c5988ee98d94',
        'network': 0,
        'xdr': 'AAAAAgAAAABTWgh1bRm6Aksd3hHdZ0hlVxDTTfqfP2kfxwVWAsCDjgAAAMgACCbgAAAAAgAAAAEAAAAAAAAAAAAAAABihthYAAAAAQAAAAUxMTExMQAAAAAAAAEAAAAAAAAAAQAAAABTWgh1bRm6Aksd3hHdZ0hlVxDTTfqfP2kfxwVWAsCDjgAAAAAAAAAAAJiWgAAAAAAAAAAA',
        'signatures': [],
        'minTime': 0,
        'status': 'pending'
    })
    await storageLayer.dataProvider.saveTransaction({
        'hash': 'e59a325bad4dec41bdbee7c172663164c98d768ce6861c3ea6f4c5988ee98d95',
        'network': 0,
        'xdr': 'A',
        'signatures': [],
        'minTime': 9999999999,
        'status': 'pending'
    })
    await storageLayer.dataProvider.saveTransaction({
        'hash': 'b41593701fd2abd7083005f341539cdabd9ca20061da59af9018b060d995f30e',
        'network': 1,
        'xdr': 'AAAAAgAAAABTWgh1bRm6Aksd3hHdZ0hlVxDTTfqfP2kfxwVWAsCDjgAAAGQACCbgAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAQxMTExAAAAAQAAAAAAAAABAAAAAFNaCHVtGboCSx3eEd1nSGVXENNN+p8/aR/HBVYCwIOOAAAAAAAAAAAHJw4AAAAAAAAAAAA=',
        'signatures': [
            {
                'key': 'GDNMOFMXT7ZGAN3SV5LBYYJVYEUPM5LQWL2NF2WW7JFG4LQLRFU2MQ3I',
                'signature': 'KYywpOZvDAdMdKO1PheptqMud0Du1hT29ylPr4QqClFx+jyE7JhMW4HjiUdRBD9OEz+k4vIrdoeRNrx0ldA7Cg=='
            },
            {
                'key': 'GBJVUCDVNUM3UASLDXPBDXLHJBSVOEGTJX5J6P3JD7DQKVQCYCBY5PP2',
                'signature': '163pcVW3n7py3aqdP1Mm8wCwdqbsHymJQ1e6GdaToJ1tsJUKgEIgvQjq9IejMVqQDCrRiXrbiQHMddv6HilqAQ=='
            }
        ],
        'submit': true,
        'callbackUrl': 'https://postman-echo.com/',
        'minTime': 0,
        'status': 'ready'
    })

    finalizer.targetQueueSize = 1
    finalizer.tickerTimeout = 100
    finalizer.setQueueConcurrency(1)

    await new Promise(resolve => {
        const callbacksExecuted = [],
            transactionsSubmitted = []
        setCallbackHandler(txInfo => new Promise(resolve => {
            callbacksExecuted.push(txInfo.hash)
            setTimeout(() => resolve({statusCode: 200}), 10)
        }))

        setSubmitTransactionCallback(txInfo => new Promise(resolve => {
            transactionsSubmitted.push(txInfo.hash)
            setTimeout(() => resolve({result: 'ok'}), 10)
        }))

        finalizer.start()
        setTimeout(() => {
            //first check - 2 entries should be ready
            expect(callbacksExecuted).toStrictEqual(['d7e4f7cb585b517ec198afcb5f8501ac8aafda64d43150e2852de37cd577c772'])
            expect(transactionsSubmitted).toStrictEqual(['89d6c423a51e030b392f0e7505e9f3b66be11cb1477aecda79a34e5ae61060e4'])
        }, 80)


        setTimeout(async () => {
            //second check - the queue should be processed entirely
            expect(callbacksExecuted).toStrictEqual(['d7e4f7cb585b517ec198afcb5f8501ac8aafda64d43150e2852de37cd577c772', 'b41593701fd2abd7083005f341539cdabd9ca20061da59af9018b060d995f30e'])
            expect(transactionsSubmitted).toStrictEqual(['89d6c423a51e030b392f0e7505e9f3b66be11cb1477aecda79a34e5ae61060e4', 'b41593701fd2abd7083005f341539cdabd9ca20061da59af9018b060d995f30e'])
            const processedEntries = await storageLayer.dataProvider.listTransactions({status: 'processed'}).toArray()
            expect(processedEntries.map(v => v.hash)).toStrictEqual(['89d6c423a51e030b392f0e7505e9f3b66be11cb1477aecda79a34e5ae61060e4', 'd7e4f7cb585b517ec198afcb5f8501ac8aafda64d43150e2852de37cd577c772', 'b41593701fd2abd7083005f341539cdabd9ca20061da59af9018b060d995f30e'])
            finalizer.stop()
                .then(resolve)
        }, 250)
    })
})