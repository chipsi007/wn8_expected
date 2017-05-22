#WN8 Expected Values Updater by Gryphon
memory.limit(size=120000)
require(dplyr)

#load current expected values from wnefficiency.net - currently version 30
wnefficiencyURL <- "expected.csv"
expectedValues <- read.csv(wnefficiencyURL)
names(expectedValues) <- c("compDescr", "eFRAG", "eDAMAGE","eSPOT", "eDEF", "eWIN")
newExpectedValues <- expectedValues

listOfTanks <- summarize(group_by(expectedValues, compDescr), users = n() )

library(DBI)
dbdir <- "./R_db"
con <- dbConnect(MonetDBLite::MonetDBLite(), dbdir)

#dbWriteTable(con, "stats", "temp.csv")

#plot function
require(ggplot2)
ggplotRegression <- function (fit, title) {
    ggplot(fit$model, aes_string(x = names(fit$model)[2], y = names(fit$model)[1])) + 
        geom_point() +
        stat_smooth(method = "lm", col = "red") +
        labs(title = paste(title,":", names(fit$model)[1], "=", round(fit$coef[[1]],2), "+", + round(fit$coef[[2]],2), "*", names(fit$model)[2],
                           "; Adj R2=", round(summary(fit)$adj.r.squared, 2)))
}

for (i in listOfTanks$compDescr) {
    #sample <- userTankStatsFiltered[userTankStatsFiltered$compDescr == i,]
	sample <- dbGetQuery(con, sprintf('SELECT * FROM stats WHERE \"compDescr\" = %i', i));
	gc()
	print(sprintf("tank: %i", i))
	if (nrow(sample) > 0) {	
		rDAMAGEmodel <- lm(rDAMAGE ~ user_rDAMAGE, data=sample, weights=battles)
		rDAMAGEcorrection <- rDAMAGEmodel$coef[[1]] + rDAMAGEmodel$coef[[2]]
		eDAMAGE_new <- round(rDAMAGEcorrection * expectedValues$eDAMAGE[expectedValues$compDescr == i], 2)
		newExpectedValues$eDAMAGE[newExpectedValues$compDescr == i] <- eDAMAGE_new
		rFRAGmodel <- lm(rFRAG ~ user_rFRAG, data=sample, weights=battles)
		rFRAGcorrection <- rFRAGmodel$coef[[1]] + rFRAGmodel$coef[[2]]
		eFRAG_new <- round(rFRAGcorrection * expectedValues$eFRAG[expectedValues$compDescr == i], 2)
		newExpectedValues$eFRAG[newExpectedValues$compDescr == i] <- eFRAG_new
		rSPOTmodel <- lm(rSPOT ~ user_rSPOT, data=sample, weights=battles)
		rSPOTcorrection <- rSPOTmodel$coef[[1]] + rSPOTmodel$coef[[2]]
		eSPOT_new <- round(rSPOTcorrection * expectedValues$eSPOT[expectedValues$compDescr == i], 2)
		newExpectedValues$eSPOT[newExpectedValues$compDescr == i] <- eSPOT_new
		rDEFmodel <- lm(rDEF ~ user_rDEF, data=sample, weights=battles)
		rDEFcorrection <- rDEFmodel$coef[[1]] + rDEFmodel$coef[[2]]
		eDEF_new <- round(rDEFcorrection * expectedValues$eDEF[expectedValues$compDescr == i], 2)
		newExpectedValues$eDEF[newExpectedValues$compDescr == i] <- eDEF_new
		rWINmodel <- lm(rWIN ~ user_rWIN, data=sample, weights=battles)
		rWINcorrection <- rWINmodel$coef[[1]] + rWINmodel$coef[[2]]
		eWIN_new <- round(rWINcorrection * expectedValues$eWIN[expectedValues$compDescr == i], 2)
		newExpectedValues$eWIN[newExpectedValues$compDescr == i] <- eWIN_new
		
		#run rSTATc vs user_rSTATc plots for all tanks
		jpegString <- paste("plots/", names(rDAMAGEmodel$model)[1],"_vs_",names(rDAMAGEmodel$model)[2], "_v31_%i.jpg")
		ggplotRegression(rDAMAGEmodel, listOfTanks$title[listOfTanks$compDescr == i] )
		savedPlot <- sprintf(jpegString, listOfTanks$compDescr[listOfTanks$compDescr == i])
		ggsave(file=savedPlot, width=7, height=7)
		
		#run rSTATc vs user_rSTATc plots for all tanks
		WN8_model <- lm(WN8 ~ user_WN8, data=sample, weights=battles)
		jpegString <- paste("plots/", names(WN8_model$model)[1],"_vs_",names(WN8_model$model)[2], "_v31_%i.jpg")
		ggplotRegression(WN8_model, listOfTanks$title[listOfTanks$compDescr == i] )
		savedPlot <- sprintf(jpegString, listOfTanks$compDescr[listOfTanks$compDescr == i])
		ggsave(file=savedPlot, width=7, height=7)
	}
}

any(is.na(newExpectedValues))
newExpectedValues <- newExpectedValues[,c("compDescr","eFRAG", "eDAMAGE", "eSPOT", "eDEF",  "eWIN")]

#export new values
date <- as.Date(Sys.Date(), "%m/%d/%Y" )
expected_value_filename <- paste("output",date,".csv")
write.csv(x=newExpectedValues,file=expected_value_filename ,row.names = FALSE)
