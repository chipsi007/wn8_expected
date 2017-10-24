library(sqldf)
db <- dbConnect(SQLite(), dbname="temp.sqlite")
listOfTanks <- read.csv("tankList.csv")

wnefficiencyURL <- "expected.csv"
expectedValues <- read.csv(wnefficiencyURL)
names(expectedValues) <- c("compDescr", "eFRAG", "eDAMAGE","eSPOT", "eDEF", "eWIN")
newExpectedValues <- expectedValues

for (i in listOfTanks$compDescr){
  print(sprintf("Loading tank: %i", i))
	sample <- dbGetQuery(db, paste("SELECT * FROM temp WHERE compDescr = ", i))
	if (nrow(sample) > 0) {	
		print(sprintf("Handling tank: %i", i))
		rDAMAGEmodel <- lm(rDAMAGE ~ user_rDAMAGE, data=sample)
		rDAMAGEcorrection <- rDAMAGEmodel$coef[[1]] + rDAMAGEmodel$coef[[2]]
		eDAMAGE_new <- round(rDAMAGEcorrection * expectedValues$eDAMAGE[expectedValues$compDescr == i], 2)
		newExpectedValues$eDAMAGE[newExpectedValues$compDescr == i] <- eDAMAGE_new
		rFRAGmodel <- lm(rFRAG ~ user_rFRAG, data=sample)
		rFRAGcorrection <- rFRAGmodel$coef[[1]] + rFRAGmodel$coef[[2]]
		eFRAG_new <- round(rFRAGcorrection * expectedValues$eFRAG[expectedValues$compDescr == i], 2)
		newExpectedValues$eFRAG[newExpectedValues$compDescr == i] <- eFRAG_new
		rSPOTmodel <- lm(rSPOT ~ user_rSPOT, data=sample)
		rSPOTcorrection <- rSPOTmodel$coef[[1]] + rSPOTmodel$coef[[2]]
		eSPOT_new <- round(rSPOTcorrection * expectedValues$eSPOT[expectedValues$compDescr == i], 2)
		newExpectedValues$eSPOT[newExpectedValues$compDescr == i] <- eSPOT_new
		rDEFmodel <- lm(rDEF ~ user_rDEF, data=sample)
		rDEFcorrection <- rDEFmodel$coef[[1]] + rDEFmodel$coef[[2]]
		eDEF_new <- round(rDEFcorrection * expectedValues$eDEF[expectedValues$compDescr == i], 2)
		newExpectedValues$eDEF[newExpectedValues$compDescr == i] <- eDEF_new
		rWINmodel <- lm(rWIN ~ user_rWIN, data=sample)
		rWINcorrection <- rWINmodel$coef[[1]] + rWINmodel$coef[[2]]
		eWIN_new <- round(rWINcorrection * expectedValues$eWIN[expectedValues$compDescr == i], 2)
		newExpectedValues$eWIN[newExpectedValues$compDescr == i] <- eWIN_new	
	}
}


newExpectedValues <- newExpectedValues[,c("compDescr","eFRAG", "eDAMAGE", "eSPOT", "eDEF",  "eWIN")]

#export new values
date <- as.Date(Sys.Date(), "%m/%d/%Y" )
expected_value_filename <- paste("output2",date,".csv")
write.csv(x=newExpectedValues,file=expected_value_filename ,row.names = FALSE)